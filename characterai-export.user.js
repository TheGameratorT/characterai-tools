// ==UserScript==
// @name         CharacterAI Exporter
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  A script to export a conversation from CharacterAI
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
            // no character perms, use info-cache instead
            const charCacheInfoResp = await fetch(`chat/character/info-cached/${charId}/`, {
                headers: {
                    'authorization': auth,
                    'accept': 'application/json, text/plain, */*',
                    'content-type': 'application/json'
                }
            });
            if (!getIsJsonContent(charCacheInfoResp)) {
                alert('Failed to fetch character info, you might be on a waiting queue, reload the page and try again.');
                return;
            }
            const charCacheInfo = await charCacheInfoResp.json();

            const catgInfoResp = await fetch('chat/character/categories/', {
                headers: {
                    'authorization': auth,
                    'accept': 'application/json, text/plain, */*',
                    'content-type': 'application/json'
                }
            });
            if (!getIsJsonContent(catgInfoResp)) {
                alert('Failed to fetch character info, you might be on a waiting queue, reload the page and try again.');
                return;
            }
            const catgInfo = await catgInfoResp.json();

            charInfo = { character: {...charCacheInfo.character, categories: catgInfo.categories} };
        }

		// Fetch messages
		const scrollBar = document.getElementById('scrollBar');
		const scrollComponent = scrollBar.querySelector('.infinite-scroll-component__outerdiv');
		const msgRows = scrollComponent.querySelectorAll('.msg-row');

		let msgTexts = [];

		for (let i = msgRows.length - 1; i >= 0; i--) {
			const props = getProps(msgRows[i]).children.props;
			let msg = null;
			if (i == 0) {
				msg = props.children[1].props.children[0].props.children.props.msg;
			} else {
				msg = props.msg;
			}
			msgTexts.push([msg.isCharTurn ? 1 : 0, msg.candidates[0].text]);
		}

		// Download avatars
		const userAccount = userInfo.user.user.account;
		const charAccount = charInfo.character;

		let userAvatar = null;
		if (userAccount.avatar_type == 'UPLOADED') {
			userAvatar = await getAvatar(userAccount.avatar_file_name);
		}
		let charAvatar = null;
		if (charAccount.avatar_file_name) {
			charAvatar = await getAvatar(charAccount.avatar_file_name);
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
		const fancyJson = makeFancyJsonStr({
			user: {
				name: userAccount.name,
				avatar: userAvatar
			},
			character: {
				name: charAccount.name,
				title: charAccount.title,
				greeting: charAccount.greeting,
				description: charAccount.description,
				definition: charAccount.definition,
				categories: charCategories,
				avatar: charAvatar
			}
		}, msgTexts);

		// Download
		const blob = new Blob([fancyJson], {type: 'application/json'});
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.style.display = 'none';
		a.href = url;
		a.download = 'chat.json';
		a.click();
		window.URL.revokeObjectURL(url);
	};

    const onUpdate = ()=>{
        if (!document.getElementById('cai-dl-btn')) {
            const hdrBtns = document.querySelector('.col-auto.px-2.dropdown')?.parentElement;
            if (hdrBtns) {
                // Inject the download button
                const newBtn = document.createElement('button');
                newBtn.id = 'cai-dl-btn';
                newBtn.className = 'col-auto px-2';
                newBtn.innerHTML = 'DL';
                newBtn.onclick = downloadChat;
                hdrBtns.insertBefore(newBtn, hdrBtns.children[0]);
            }
        }
    };

    onUpdate();
    setInterval(onUpdate, 1000);
})();
