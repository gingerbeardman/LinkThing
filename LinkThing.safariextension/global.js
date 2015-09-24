const defaults = {
	kickOnLinks           : 0,
	kickOffLinks          : 0,
	newTabPosition        : null,
	newBgTabPosition      : null,
	focusLinkTarget       : true,
	preferWindows         : false,
	cmdClickIgnoresTarget : true,
	rightClickForCmdClick : false,
	useTPOverrideKeys     : false,
	tpOverrideKeyClicks   : false,
	rewriteGoogleLinks    : false,
	showLinkHrefs         : true,
	showMenuItems         : true,
	focusOriginalTab      : false,
	tpoKeyLeftmost        : { keyCode: 65, keyIdentifier: 'U+0041' },
	tpoKeyLeft            : { keyCode: 83, keyIdentifier: 'U+0053' },
	tpoKeyRight           : { keyCode: 68, keyIdentifier: 'U+0044' },
	tpoKeyRightmost       : { keyCode: 70, keyIdentifier: 'U+0046' },
	tpoKeyCurrent         : { keyCode: 71, keyIdentifier: 'U+0047' },
	lastPrefPane          : 0,
	specialSites          : [],
	hardBlacklist         : [],
	userBlacklist         : [
		'//www.example.com/',
		'^https?:\\/\\/www\\.example(\\.[a-z]+)+'
	],
};
const linkBlacklist = [
	/\/\/www\.google(\.[a-z]+)+\/reader\/view\//,
	/\/\/api\.flattr\.com\//
];
const downloadPatterns = [
	/\.dmg$/, /\.dmg\?/,
	/\.zip$/, /\.zip\?/,
	/\.pkg$/, /\.pkg\?/,
	/\.safariextz$/, /\.safariextz\?/,
	/\.torrent$/, /\.torrent\?/,
	/\.iso$/, /\.iso\?/,
	/\.rar$/, /\.rar\?/,
	/\.exe$/, /\.exe\?/,
	/\.tgz$/, /\.tgz\?/,
	/\.gz$/ , /\.gz\?/ ,
	/\.tar$/, /\.tar\?/,
	/\.xar$/, /\.xar\?/,
	/\.odm$/, /\.odm\?/,
	/\.acsm$/, /\.acsm\?/
];

var sa = safari.application;
var se = safari.extension;
var openedTabs = []; // to keep Safari from GCing tab references
var dummyLink = document.createElement('a');

if (navigator.appVersion.match('Version/5.0')) {
	sa.activeBrowserWindow.openTab().url = se.baseURI + 'upgrade_notice.html';
} else {
	initializeSettings();

	sa.addEventListener("contextmenu", handleContextMenu, false);
	sa.addEventListener("command", handleCommand, false);
	sa.addEventListener("message", handleMessage, false);
	se.settings.addEventListener("change", handleSettingChange, false);

	se.addContentScriptFromURL(se.baseURI + 'injected.js', ['safari-reader://*/*'], null, true);
}

function SettingsObject(addedProps) {
	for (var key in defaults) {
		if (!(defaults[key] instanceof Array)) {
			this[key] = se.settings[key]
		}
	}
	for (var p in addedProps) {
		this[p] = addedProps[p];
	}
}
function addLinkToIp(info) {
	var sourceTab = sa.activeBrowserWindow.activeTab;
	var xhr = new XMLHttpRequest();
	var ipUrl = 'https://www.instapaper.com/api/add';
		ipUrl += '?username=' + encodeURIComponent(se.secureSettings.ipUsername);
		ipUrl += '&password=' + encodeURIComponent(se.secureSettings.ipPassword);
		ipUrl += '&url='      + encodeURIComponent(info.url);
		ipUrl += '&selection=Added%20from%20"' + encodeURIComponent(info.tit);
		ipUrl += '"%20(' + encodeURIComponent(info.ref) + ')';
	xhr.onreadystatechange = function() {
		if (xhr.readyState === 4) {
			if (xhr.responseText == 201) {
				sourceTab.page.dispatchMessage('ipAddState','saved');
			} else {
				sourceTab.page.dispatchMessage('ipAddState','failed');
				var message = 'LinkThing could not log in to your Instapaper account. ';
					message += 'Please check your username and password.';
				alert(message);
			}
		}
	};
	xhr.open('GET', ipUrl, true);
	xhr.send(null);
	sourceTab.page.dispatchMessage('ipAddState','saving');
}
function getBlacklistStatus(url) {
	function stringToRe(string) {
		return new RegExp(string, 'i');
	}
	for (var i = 0; i < se.settings.userBlacklist.length; i++) {
		if (stringToRe(se.settings.userBlacklist[i]).test(url)) {
			return 2;
		}
	}
	for (var i = 0; i < se.settings.hardBlacklist.length; i++) {
		if (stringToRe(se.settings.hardBlacklist[i]).test(url)) {
			return 1;
		}
	}
	return 0;
}
function getSitePrefs(hostname) {
	for (var i = 0; i < se.settings.specialSites.length; i++) {
		if (hostname === se.settings.specialSites[i].hostname) {
			return se.settings.specialSites[i];
		}
	}
	return {
		hostname         : hostname,
		kickOffLinks     : null,
		kickOnLinks      : null,
		newTabPosition   : null,
		newBgTabPosition : null,
		focusLinkTarget  : null,
		preferWindows    : null
	};
}
function handleCommand(event) {
	var sourceTab = sa.activeBrowserWindow.activeTab;
	if (event.command === 'showPrefsBox') {
		if (sourceTab.url == '' || sourceTab.url == undefined) {
			var am = 'Sorry, LinkThing cannot open its settings here.';
			am += 'Please load a web page in this tab and try again.';
			alert(am);
		} else {
			sourceTab.page.dispatchMessage('showPrefsBox', event.userInfo);
		}
	}
	else if (event.command === 'addLinkToIp') {
		addLinkToIp(event.userInfo);
	}
}
function handleContextMenu(event) {
	if (event.userInfo && se.settings.showMenuItems) {
		event.contextMenu.appendContextMenuItem('showPrefsBox','LinkThing Settings...');
	}
	if (event.userInfo.url && se.secureSettings.ipUsername) {
		event.contextMenu.appendContextMenuItem('addLinkToIp','Add Link to Instapaper');
	}
}
function handleLinkKick(event) {
	console.log('link kick:', event.message);
	var settings = event.message.settings;
	var targetIsReader = event.target instanceof SafariReader;
	var sourceTab = targetIsReader ? event.target.tab : event.target;
	var thisWindow = sourceTab.browserWindow;
	var srcTabIndex = thisWindow.tabs.indexOf(sourceTab);
	var background = !(event.message.shift ^ settings.focusLinkTarget);
	var tpo = event.message.tpo;
	var positionSetting = event.message.positionSetting;
	var newTab;
	if (positionSetting === null)
		return;
	if (tpo.fr)
		background = !background;
	if (targetIsReader)
		background = true;
	if (positionSetting === undefined)
		positionSetting = 1;
	if (event.message.option) {
		newTab = sa.openBrowserWindow().activeTab;
		newTab.url = event.message.href;
		background && thisWindow.activate();
	} else {
		var newTabPosition = (
			positionSetting == -2 ? 0                      : 
			positionSetting ==  0 ? srcTabIndex            :
			positionSetting ==  1 ? srcTabIndex + 1        :
			positionSetting == -1 ? thisWindow.tabs.length : null
		);
		newTab = thisWindow.openTab((background ? 'background' : 'foreground'), newTabPosition);
		newTab.url = event.message.href;
	}
	newTab.sourceTab = sourceTab;
	openedTabs.push(newTab);
	newTab.addEventListener('close', function (closeEvent) {
		var closedTab = closeEvent.target;
		openedTabs.splice(openedTabs.indexOf(closedTab), 1);
		if (!se.settings.focusOriginalTab)
			return;
		if (closedTab.sourceTab && closedTab.sourceTab.url) {
			closedTab.sourceTab.activate();
		}
	}, false);
}
function handleMessage(event) {
	switch (event.name) {
		case 'handleLinkMouseOver':
			event.target.page.dispatchMessage('showHrefBox', event.message);
		break;
		case 'handleLinkMouseOut':
			event.target.page.dispatchMessage('hideHrefBox');
		break;
		case 'handleLinkKick':
			handleLinkKick(event);
		break;
		case 'loadInMyTab':
			// message source must be a SafariReader instance
			event.target.tab.url = event.message;
		break;
		case 'passSettings':
			if (!event.message || !event.message.hostname)
				break;
			var settings = new SettingsObject({
				hostname         : event.message,
				linkBlacklist    : linkBlacklist,
				downloadPatterns : downloadPatterns,
				blacklistStatus  : getBlacklistStatus(event.message.url),
			});
			var sitePrefs = getSitePrefs(event.message.hostname);
			for (var key in sitePrefs) {
				if (sitePrefs[key] !== null) {
					settings[key] = sitePrefs[key];
				}
			}
			var listener = (event.target instanceof SafariReader) ? event.target : event.target.page;
			listener.dispatchMessage('receiveSettings', settings);
		break;
		case 'whoAreMyFellowFrames?':
			event.target.page.dispatchMessage('giveMeYourWindowName', event.message);
		break;
		case 'myWindowNameIs':
			event.target.page.dispatchMessage('youHaveAFellowFrameNamed:', event.message);
		break;
		case 'logThis':
			console.log(event.message);
		break;
		case 'passPrefs':
			try {
				var hostname = event.target.url.split('//')[1].split('/')[0];
			} catch (e) {
				var hostname = 'nohost';
			}
			var settings = new SettingsObject({
				hostname      : hostname,
				sitePrefs     : getSitePrefs(hostname),
				lastPrefPane  : se.settings.lastPrefPane,
				userBlacklist : se.settings.userBlacklist,
			});
			event.target.page.dispatchMessage('receivePrefs', settings);
		break;
		case 'saveLastPrefPane':
			se.settings.lastPrefPane = event.message;
		break;
		case 'saveSitePrefs':
			var specialSites = se.settings.specialSites;
			var ssEntry = specialSites.filter(function (ss) {
				return ss.hostname == event.message.hostname;
			})[0];
			if (!ssEntry) {
				ssEntry = {};
				specialSites.unshift(ssEntry);
			}
			for (var key in event.message) {
				ssEntry[key] = event.message[key];
			}
			for (var key in ssEntry) {
				if (ssEntry[key] == null) {
					delete ssEntry[key];
				}
			}
			if (specialSites.length > 300) {
				specialSites.pop();
			}
			se.settings.specialSites = specialSites;
			passNewSettingsToAllPages();
		break;
		case 'saveGlobalPrefs':
			for (var key in event.message) {
				se.settings[key] = event.message[key];
			}
			passNewSettingsToAllPages();
		break;
		case 'saveTPOverrideKey':
			se.settings[event.message.which] = event.message.data;
			passNewSettingsToAllPages();
		break;
		case 'saveUrlFilters':
			var filterStrings = event.message.split('\n');
			saveUserBlacklist(filterStrings);
			passNewSettingsToAllPages();
		break;
		case 'requestClosePrefsBox':
			event.target.page.dispatchMessage('prepareToClose');
		break;
		case 'closePrefsBox':
			event.target.page.dispatchMessage('closePrefsBox');
		break;
		case 'consoleLog':
			console.log.apply(window, event.message);
		break;
	}
}
function handleSettingChange(event) {
	if (event.newValue !== event.oldValue) {
		switch (event.key) {
			default: {
			}
		}
	}
}
function passNewSettingsToAllPages() {
	var message = {};
	var thisWindow = {};
	var thisTab = {};
	for (var j = 0; j < sa.browserWindows.length; j++) {
		thisWindow = sa.browserWindows[j];
		for (var k = 0; k < thisWindow.tabs.length; k++) {
			thisTab = thisWindow.tabs[k];
			if (thisTab.url && thisTab.url.match(/^http/)) {
				console.log('Passing settings to page at ' + thisTab.url);
				dummyLink.href = thisTab.url;
				var settings = new SettingsObject({
					hostname        : dummyLink.hostname,
					blacklistStatus : getBlacklistStatus(thisTab.url),
				});
				var sitePrefs = getSitePrefs(dummyLink.hostname);
				for (var key in sitePrefs) {
					if (sitePrefs[key] !== null) {
						settings[key] = sitePrefs[key];
					}
				}
				thisTab.page.dispatchMessage('receiveSettings', settings);
			}
		}
	}
}
function saveUserBlacklist(filterStrings) {
	function isNotEmpty(string) {
		return string !== '';
	}
	se.settings.userBlacklist = filterStrings.filter(isNotEmpty);
}
function initializeSettings() {
	var lastVersion = se.settings.lastVersion;
	for (var key in defaults) {
		if (se.settings[key] === undefined) {
			se.settings[key] = defaults[key];
		}
	}
	if (lastVersion < 1006) {
		se.settings.cmdClickIgnoresTarget = false;
	}
	if (lastVersion < 1018) {
		se.settings.rewriteGoogleLinks = false;
	}
	if (lastVersion < 2009) {
		se.settings.userBlacklist = defaults.userBlackList;
	}
	if (lastVersion < 2042) {
		if (se.settings.newTabPosition   == undefined) se.settings.newTabPosition   = 1;
		if (se.settings.newBgTabPosition == undefined) se.settings.newBgTabPosition = 1;
	}
	if (lastVersion < 2051) {
		if (se.settings.newTabPosition   == 1) se.settings.newTabPosition   = null;
		if (se.settings.newBgTabPosition == 1) se.settings.newBgTabPosition = null;
	}
	se.settings.lastVersion = 2051;
}
