const NEWLINE_REGEX = /\n/g;

let indexPage, chatPage;
let userAvatar, charAvatar;
let floatMenu, floatMenuHint, inFloatMenu;
let infoModal;
let mdcvtr; // markdown converter

function main() {
	indexPage = document.getElementById('index-page-container');
	chatPage = document.getElementById('chat-page-container');
	floatMenu = document.getElementById('chat-floatmenu');
	floatMenuHint = document.getElementById('chat-floatmenu-hint');
	inFloatMenu = false;
	infoModal = document.getElementById('chat-info-modal');
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
	let request = await fetch(avatarUrl);
	let blob = await request.blob();
	return URL.createObjectURL(blob);
}

async function loadChatData(jsonData) {
	const userInfo = jsonData.user;
	const charInfo = jsonData.character;

	userAvatar = await loadAvatar(userInfo.avatar);
	charAvatar = await loadAvatar(charInfo.avatar);

	const msgs = jsonData.messages;
	let msgsHtml = '';

	for (let i = 0; i < msgs.length; i++) {
		const msg = msgs[i];
		const msgTxtHtml = mdcvtr.makeHtml(msg[1]);
		
		msgsHtml +=
`<div class="message-row" ${i==0 ? '' : ' style="margin-top: 16px"'}>
	<div class="inner">
		<div class="avatar">
			<img src="${msg[0] ? charAvatar : userAvatar}">
		</div>
		<div class="title">
			<b>${msg[0] ? charInfo.name : userInfo.name}</b>
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
	charNameElem.innerHTML =
`<p><b>Name</b><br>${charInfo.name}</p>
<p><b>Title</b><br>${charInfo.title}</p>`;

	const charGreetElem = document.getElementById('chat-info-char-greet');
	charGreetElem.innerHTML = mdcvtr.makeHtml(charInfo.greeting);
	const charDescElem = document.getElementById('chat-info-char-desc');
	charDescElem.innerHTML = mdcvtr.makeHtml(charInfo.description);
	const charDefnElem = document.getElementById('chat-info-char-defn');
	charDefnElem.innerHTML = charInfo.definition.replace(NEWLINE_REGEX, '<br>');
	
	const catgList = charInfo.categories.split(';');
	let catgHtml = '';
	for (let i = 0; i < catgList.length; i++) {
		catgHtml += `<div class="chat-info-tag"${i == (catgList.length - 1) ? '' : 'style="margin-right: 16px"'}>${catgList[i]}</div>`;
	}
	const charCatgElem = document.getElementById('chat-info-char-catg');
	charCatgElem.innerHTML = catgHtml;
	
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
