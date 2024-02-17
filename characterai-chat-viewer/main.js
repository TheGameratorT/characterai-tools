const NEWLINE_REGEX = /\n/g;

let indexPage, chatPage;
let userAvatar, charAvatar;
let floatMenu, floatMenuHint, inFloatMenu;
let infoModal;
let infoPersonas;
let loadedAvatars = [];
let mdcvtr; // markdown converter

function main() {
	indexPage = document.getElementById('index-page-container');
	chatPage = document.getElementById('chat-page-container');
	floatMenu = document.getElementById('chat-floatmenu');
	floatMenuHint = document.getElementById('chat-floatmenu-hint');
	inFloatMenu = false;
	infoModal = document.getElementById('chat-info-modal');
	infoPersonas = document.getElementById('chat-info-personas-block');
	mdcvtr = new showdown.Converter();
}

function allowDrop(ev) {
	ev.preventDefault();
}

async function drop(ev) {
	ev.preventDefault();
	let file = null;
	[...ev.dataTransfer.items].every((item, i) => {
		if (item.kind === 'file' && item.type === 'application/json') {
			file = item.getAsFile();
			return false;
		}
		return true;
	});
	if (file) {
		let objUrl = URL.createObjectURL(file);
		let response = await fetch(objUrl);
		let jsonData = await response.json();
		URL.revokeObjectURL(objUrl);
		loadChatData(jsonData);
	}
}

function dropClick() {
	let input = document.createElement('input');
	input.type = 'file';
	
	input.onchange = async e => { 
		let file = e.target.files[0];
		
		let objUrl = URL.createObjectURL(file);
		let response = await fetch(objUrl);
		let jsonData = await response.json();
		URL.revokeObjectURL(objUrl);
		loadChatData(jsonData);
	}
	
	input.click();
}

async function loadAvatar(avatarUrl) {
	try {
		let request = await fetch(avatarUrl);
		let blob = await request.blob();
		let avatar = URL.createObjectURL(blob);
		loadedAvatars.push(avatar);
		return avatar;
	} catch (error) {
		console.log("Error loading avatar.");
	}
	return "images/no_image.png";
}

async function loadPersonas(jsonPersonas) {
	let personas = [];
	if (jsonPersonas) {
		for (let i = 0; i < jsonPersonas.length; i++) {
			let jsonPersona = jsonPersonas[i];
			personas.push({
				name: jsonPersona.name,
				description: jsonPersona.description,
				avatar: jsonPersona.avatar ? await loadAvatar(jsonPersona.avatar) : userAvatar
			});
		}
	}
	return personas;
}

async function loadChatData(jsonData) {
	const userInfo = jsonData.user;
	const charInfo = jsonData.character;

	userAvatar = await loadAvatar(userInfo.avatar);
	charAvatar = await loadAvatar(charInfo.avatar);

	const personas = await loadPersonas(jsonData.personas);

	const getAvatarForCharacterId = (id)=>{
		if (id == 0) { return userAvatar; }
		if (id == 1) { return charAvatar; }
		const personaId = id - 2;
		if (personaId < personas.length) {
			return personas[personaId].avatar;
		}
		return "images/no_image.png";
	};

	const getTitleForCharacterId = (id)=>{
		if (id == 0) { return userInfo.name; }
		if (id == 1) { return charInfo.name; }
		const personaId = id - 2;
		if (personaId < personas.length) {
			return personas[personaId].name;
		}
		return "&ltmissing&gt";
	};

	const msgs = jsonData.messages;
	let msgsHtml = '';

	for (let i = 0; i < msgs.length; i++) {
		const msg = msgs[i];
		const msgTxtHtml = mdcvtr.makeHtml(msg[1]);
		
		msgsHtml +=
`<div class="message-row" ${i==0 ? '' : ' style="margin-top: 16px"'}>
	<div class="inner">
		<div class="avatar">
			<img src="${getAvatarForCharacterId(msg[0])}">
		</div>
		<div class="title">
			<b>${getTitleForCharacterId(msg[0])}</b>
		</div>
		<div class="body">
			${msgTxtHtml}
		</div>
	</div>
</div>`;
	}

	const scrollContainer = document.getElementById('chat-scroll-container');
	scrollContainer.scrollTo(0, 0);

	const msgListElem = scrollContainer.children[0];
	msgListElem.innerHTML = msgsHtml;

	const userAvatarElem = document.getElementById('chat-info-user-avatar');
	userAvatarElem.src = userAvatar;
	const userNameElem = document.getElementById('chat-info-user-name');
	userNameElem.innerHTML = userInfo.name;
	
	const charAvatarElem = document.getElementById('chat-info-char-avatar');
	charAvatarElem.src = charAvatar;
	const charNameElem = document.getElementById('chat-info-char-name');
	charNameElem.innerHTML = charInfo.title ? `<p><b>Name</b><br>${charInfo.name}</p><p><b>Title</b><br>${charInfo.title}</p>` : charInfo.name;

	let setCharInfoBlock = (blockName, value, provider)=>{
		const block = document.getElementById(`chat-info-char-${blockName}-block`);
		const elem = document.getElementById(`chat-info-char-${blockName}`);
		if (value) {
			provider(elem, value);
			block.style.display = "block";
		} else {
			block.style.display = "none";
		}
	};

	setCharInfoBlock('greet', charInfo.greeting, (e,v)=>{ e.innerHTML = mdcvtr.makeHtml(v); });
	setCharInfoBlock('desc', charInfo.description, (e,v)=>{ e.innerHTML = mdcvtr.makeHtml(v); });
	setCharInfoBlock('defn', charInfo.definition, (e,v)=>{ e.innerHTML = v.replace(NEWLINE_REGEX, '<br>'); });
	setCharInfoBlock('catg', charInfo.categories, (e,v)=>{
		const catgList = v.split(';');
		let catgHtml = '';
		for (let i = 0; i < catgList.length; i++) {
			catgHtml += `<div class="chat-info-tag"${i == (catgList.length - 1) ? '' : 'style="margin-right: 16px"'}>${catgList[i]}</div>`;
		}
		e.innerHTML = catgHtml;
	});

	const floatMenuDesc = document.getElementById('chat-floatmenu-desc');
	floatMenuDesc.innerHTML = `Chat with ${charInfo.name}`;

	infoPersonas.style.display = personas.length > 0 ? 'block' : 'none';

	const personasListElem = document.getElementById('chat-info-personas-list');
	let personasHtml = '';

	for (let i = 0; i < personas.length; i++) {
		const persona = personas[i];

		personasHtml += 
`<div class="chat-info-char-block">
<div style="padding: 8px">
	<img class="chat-info-persona-avatar" src="${persona.avatar}">
	<div class="chat-info-persona-name">${persona.name}</div>`;
		if (persona.description) {
			personasHtml += `<div class="chat-info-persona-desc">${persona.description}</div>`;
		}
`</div>
</div>`;
	}

	personasListElem.innerHTML = personasHtml;
	
	indexPage.setAttribute('hidden', '');
	chatPage.removeAttribute('hidden');
}

function onFloatMenuHintOver() {
	floatMenu.classList.add('visible');
	inFloatMenu = true;
}

function onFloatMenuLeave() {
	if (inFloatMenu) {
		floatMenu.classList.remove('visible');
		inFloatMenu = false;
	}
}

function exitChat() {
	indexPage.removeAttribute('hidden');
	chatPage.setAttribute('hidden', '');

	for (let i = 0; i < loadedAvatars.length; i++) {
		URL.revokeObjectURL(loadedAvatars[i]);
	}
}

function showChatInfo() {
	infoModal.style.display = "block";
}

function closeChatInfo() {
	infoModal.style.display = "none";
}

function onWindowClick(event) {
	if (event.target == infoModal) {
		closeChatInfo();
	}
}

if (history && 'scrollRestoration' in history) {
	history.scrollRestoration = 'manual';
}

window.addEventListener('load', main);
window.addEventListener('click', onWindowClick);
