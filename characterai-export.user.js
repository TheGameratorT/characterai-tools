// ==UserScript==
// @name         character.ai Exporter
// @namespace    TheGameratorT
// @version      1.1.0
// @description  A script to export a conversation from character.ai
// @author       TheGameratorT
// @match        https://beta.character.ai/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=character.ai
// @grant        none
// ==/UserScript==

(function() {
	'use strict';

	const getProps = (element)=>{
		for (const key in element) {
			if (key.startsWith('__reactProps$')) {
				return element[key];
			}
		}
		return null;
	};

	const getBase64 = (blob)=>{
		return new Promise((resolve, reject)=>{
			let reader = new FileReader();
			reader.readAsDataURL(blob);
			reader.onloadend = ()=>{
				let base64String = reader.result;
				resolve(base64String);
			}
		});
	};

	const getAvatar = async(fileName)=>{
		let avatarResp = await fetch('https://characterai.io/i/400/static/avatars/' + fileName);
		let avatarBlob = await avatarResp.blob();
		return await getBase64(avatarBlob);
	};

	const getIsJsonContent = (response)=>{
		const contentType = response.headers.get('content-type');
		return contentType && contentType.indexOf('application/json') !== -1;
	};

	const makeFancyJsonStr = (jsonData, msgTexts)=>{
		let jsonStr = JSON.stringify(jsonData, null, '\t');

		let msgsStr = ',\n\t"messages": [\n';
		for (let i = 0; i < msgTexts.length; i++) {
			const msg = msgTexts[i];
			msgsStr += '\t\t' + JSON.stringify(msg, null, 0);
			if (i != msgTexts.length - 1) {
				msgsStr += ',';
			}
			msgsStr += '\n';
		}
		msgsStr += '\t]\n';

		jsonStr = jsonStr.substring(0, jsonStr.length - 2) + msgsStr + '}';

		return jsonStr;
	};

	const downloadChat = async()=>{
		const token = JSON.parse(localStorage.getItem('char_token')).value;
		const auth = `Token ${token}`;
		const charId = new URLSearchParams(window.location.search).get('char');

		// Download user info
		const userInfoResp = await fetch('chat/user/', {
			headers: {
				'authorization': auth,
				'accept': 'application/json, text/plain, */*',
				'content-type': 'application/json'
			}
		});
		if (!getIsJsonContent(userInfoResp)) {
			alert('Failed to fetch user info, you might be on a waiting queue, reload the page and try again.');
			return;
		}
		const userInfo = await userInfoResp.json();

		// Download character info
		const charInfoResp = await fetch('chat/character/', {
			method: 'POST',
			headers: {
				'authorization': auth,
				'accept': 'application/json, text/plain, */*',
				'content-type': 'application/json'
			},
			body: `{"external_id": "${charId}"}`
		});
		if (!getIsJsonContent(charInfoResp)) {
			alert('Failed to fetch character info, you might be on a waiting queue, reload the page and try again.');
			return;
		}
		let charInfo = await charInfoResp.json();

		if (charInfo.character.length == 0) {
			// no character perms, get info only instead
			const charCacheInfoResp = await fetch(`chat/character/info/`, {
				method: 'POST',
				headers: {
					'authorization': auth,
					'accept': 'application/json, text/plain, */*',
					'content-type': 'application/json'
				},
				body: `{"external_id": "${charId}"}`
			});
			if (!getIsJsonContent(charCacheInfoResp)) {
				alert('Failed to fetch character info, you might be on a waiting queue, reload the page and try again.');
				return;
			}
			const charCacheInfo = await charCacheInfoResp.json();

			charInfo = { character: {...charCacheInfo.character, categories: []} };
		}

		const userAccount = userInfo.user.user.account;
		const charAccount = charInfo.character;
		
		// Download user personas info
		const userPersonasResp = await fetch('chat/personas/?force_refresh=1', {
			headers: {
				'authorization': auth,
				'accept': 'application/json, text/plain, */*',
				'content-type': 'application/json'
			}
		});
		if (!getIsJsonContent(userPersonasResp)) {
			alert('Failed to fetch user personas info, you might be on a waiting queue, reload the page and try again.');
			return;
		}
		const userPersonasInfo = await userPersonasResp.json();
		const userPersonas = userPersonasInfo.personas;

		const getPersonaDescription = (name, avatarFileName)=>{
			for (let i = 0; i < userPersonas.length; i++) {
				const userPersona = userPersonas[i];
				if (userPersona.title == name && userPersona.avatar_file_name == avatarFileName) {
					return userPersona.definition;
				}
			}
			return "";
		}

		// Fetch messages
		const messageContainer = document.querySelector('.chat2')?.children[1]?.children[0] ?? null;
		if (messageContainer == null) {
			alert('Failed to locate the messages container.');
			return;
		}
		const msgRows = messageContainer.children;
		if (msgRows == null) {
			alert('Failed to locate any messages.');
			return;
		}

		let msgTexts = [];
		let personas = [];

		const getOrCreateCharacterId = (name, avatarFileName)=>{
			const isUserAvatar = avatarFileName == userAccount.avatar_file_name;
			if (userAccount.name == name && isUserAvatar) {
				return 0;
			}
			if (charAccount.name == name && avatarFileName == charAccount.avatar_file_name) {
				return 1;
			}
			const newAvatarFileName = isUserAvatar ? "" : avatarFileName;
			let id = 0;
			for (id = 0; id < personas.length; id++) {
				let persona = personas[id];
				if (persona.name == name && persona.avatarFileName == newAvatarFileName) {
					return id + 2;
				}
			}
			personas.push({
				name: name,
				description: getPersonaDescription(name, newAvatarFileName),
				avatarFileName: newAvatarFileName
			});
			return id + 2;
		};

		for (let i = 0; i < msgRows.length; i++) {
			const msgRow = msgRows[i];
			
			let msg = null;
			let characterId;

			if (msgRow.classList.contains('swiper')) {
				// All swipers are always an AI message, they have no persona
				const swiperProps = getProps(msgRow).children.props;

				const swiperIndex = swiperProps.value.activeIndex;
				const textArea = swiperProps.children[1].props.children[1][swiperIndex].props.children.props;

				msg = textArea.message;
				characterId = getOrCreateCharacterId(textArea.author.name, textArea.author.avatar_url);
			} else {
				const props = getProps(msgRow);

				const lProps = props.children[0].props;
				const isCharacter = lProps.children[0] == undefined;
				const charAvatar = lProps.children[isCharacter ? 1 : 0].props.avatarFileName.slice(43); // remove (https://characterai.io/i/80/static/avatars/)

				const rProps = props.children[1].props;
				const charName = rProps.children[0].props.children[0].props.children[0];
				const textArea = rProps.children[1].props.children[0].props;
				
				msg = textArea.message;
				characterId = getOrCreateCharacterId(charName, charAvatar);
			}
			
			msgTexts.push([characterId, msg.raw_content]);
		}

		// Download avatars
		let userAvatar = null;
		if (userAccount.avatar_type == 'UPLOADED') {
			userAvatar = await getAvatar(userAccount.avatar_file_name);
		}
		let charAvatar = null;
		if (charAccount.avatar_file_name) {
			charAvatar = await getAvatar(charAccount.avatar_file_name);
		}
		let personasWithAvatar = [];
		for (let i = 0; i < personas.length; i++) {
			let persona = personas[i];
			let newPersona = { name: persona.name };
			if (persona.description != "") {
				newPersona.description = persona.description;
			}
			if (persona.avatarFileName != "") {
				newPersona.avatar = await getAvatar(persona.avatarFileName);
			}
			personasWithAvatar.push(newPersona);
		}

		// Make categories string
		let charCategories = '';
		for (let i = 0; i < charAccount.categories.length; i++) {
			charCategories += charAccount.categories[i].name;
			if (i != charAccount.categories.length - 1) {
				charCategories += ';';
			}
		}

		// Build JSON
		const ifHasValue = (value)=> (Array.isArray(value) ? value.length > 0 : !!value) ? value : undefined;

		const fancyJson = makeFancyJsonStr({
			user: {
				name: userAccount.name,
				avatar: userAvatar
			},
			character: {
				name: charAccount.name,
				title: ifHasValue(charAccount.title),
				greeting: ifHasValue(charAccount.greeting),
				description: ifHasValue(charAccount.description),
				definition: ifHasValue(charAccount.definition),
				categories: ifHasValue(charCategories),
				avatar: charAvatar
			},
			personas: ifHasValue(personasWithAvatar)
		}, msgTexts);

		// Download
		const blob = new Blob([fancyJson], {type: 'application/json'});
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.style.display = 'none';
		a.href = url;
		a.download = `Chat with ${charAccount.name}.json`;
		a.click();
		window.URL.revokeObjectURL(url);
	};

	const onUpdate = ()=>{
		if (!document.getElementById('cai-dl-btn')) {
			const hdrBtns = document.querySelector('.chat2')?.children[0]?.children[0]?.children[2]?.children[0] ?? null;
			if (hdrBtns) {
				// Inject the download button
				const newBtn = document.createElement('div');
				newBtn.id = 'cai-dl-btn';
				newBtn.className = 'shine-btn dark';
				newBtn.style = 'margin-right: 8px; padding: 8px 10px;'
				newBtn.innerHTML = '<img style="width: 100%; height: 16px; object-fit: contain;" src="data:image/png;base64,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"></center>';
				newBtn.onclick = downloadChat;
				hdrBtns.insertBefore(newBtn, hdrBtns.children[0]);
			}
		}
	};

	onUpdate();
	setInterval(onUpdate, 1000);
})();