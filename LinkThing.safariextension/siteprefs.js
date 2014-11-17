function initialize() {
	var settings = {};
	safari.self.addEventListener('message', handleMessage, false);
	safari.self.tab.dispatchMessage('passPrefs');
	document.addEventListener('keyup', function (e) {
		if (e.which == 27) closeMe();
	}, false);
	document.getElementById('filterArea').addEventListener('keydown', function (e) {
		if (e.which == 27) this.blur();
	}, false);
}
function closeMe() {
	safari.self.tab.dispatchMessage('closePrefsBox');
}
function focusTab(idx) {
	var prefTabs = document.querySelectorAll('.prefTab');
	for (var i=0; i < prefTabs.length; i++) {
		prefTabs[i].className = prefTabs[i].className.replace(' active','');
	}
	prefTabs[idx].className += ' active';

	var prefPanes = document.querySelectorAll('.prefPane');
	for (var i=0; i < prefPanes.length; i++) {
		prefPanes[i].className = prefPanes[i].className.replace(' active','');
	}
	prefPanes[idx].className += ' active';

	safari.self.tab.dispatchMessage('saveLastPrefPane', idx);
}
function getSetting(cid) {
	var control = document.getElementById(cid);
	if (control.type === 'checkbox') {
		return control.checked;
	} else {		// control is a <select>
		var cval = control.options[control.selectedIndex].value;
		return (
			cval === ''  ? null      : 
			cval === '?' ? undefined :
			cval * 1
		);
	}
}
function handleHotkeyDown(e) {
	e.stopPropagation();
	switch (e.which) {
		case 27:	// escape
			e.target.blur();
			break;
		case  8:	// backspace
		case 13:	// enter
		case 32:	// space
		case 37:	// left
		case 38:	// up
		case 39:	// right
		case 40:	// down
			e.preventDefault();
			break;
		case  9:	// tab
		case 16:	// shift
		case 17:	// ctrl
		case 18:	// option
		case 91:	// command-left
		case 93:	// command-right
			break;
		default:
			e.preventDefault();
			saveTPOverrideKey(e);
		break;
	}
}
function handleHotkeyFocus(e) {
	setTimeout(function () {
		e.target.select();
	}, 10);
}
function handleMessage(msg) {
	switch (msg.name) {
		case 'receivePrefs': {
			settings = msg.message;
			console.log('settings:', settings);
			if (settings.hostname === 'nohost') {
				focusTab(0);
				document.getElementById('localTab').style.display = 'none';
			} else {
				var siteLabel = document.getElementById('siteLabel');
				siteLabel.textContent = settings.hostname;
				focusTab(settings.lastPrefPane);
				initLocalForm();
			}
			initGlobalForm();
			initAdvancedForm();
			initFilterForm();
			document.getElementById('prefPaneBg').style.visibility = 'visible';
			break;
		}
		case 'prepareToClose': {
			document.getElementById('filterArea').blur();
			closeMe();
			break;
		}
	}
}
function initAdvancedForm() {
	var hkInputs = document.querySelectorAll('input.hotkey');
	for (var hki, i = 0; i < hkInputs.length; i++) {
		hki = hkInputs[i];
		hki.value = populateHotkeyInput(hki.id);
		hki.onfocus = handleHotkeyFocus;
		hki.onmouseup = handleHotkeyFocus;
		hki.onkeydown = handleHotkeyDown;
	}
}
function initFilterForm() {
	document.getElementById('filterArea').value = settings.userBlacklist.join('\n');
}
function initGlobalForm() {
	for (var key in settings) {
		if (key !== 'hostname' && key !== 'sitePrefs' && key !== 'lastPrefPane' && key !== 'linkBlacklist') {
			setControlValue(key, settings[key]);
		}
	}
}
function initLocalForm() {
	for (var key in settings.sitePrefs) {
		if (key !== 'hostname') {
			setControlValue('site.' + key, settings.sitePrefs[key]);
		}
	}
}
function populateHotkeyInput(inputId) {
	if (!settings[inputId]) return;
	var cStr = String.fromCharCode(settings[inputId].keyCode);
	if (!/[0-9A-Z]/.test(cStr))
		cStr = String.fromCharCode(parseInt(settings[inputId].keyIdentifier.slice(2), 16));
	if (cStr === ' ')
		cStr = 'Space';
	return cStr;
}
function saveTPOverrideKey(e) {
	e.target.blur();
	var hotkey = {};
	var props = ['keyCode','keyIdentifier'];
	for (var i = 0; i < props.length; i++)
		hotkey[props[i]] = e[props[i]];
	var message = {
		which : e.target.id,
		data  : hotkey
	};
	settings[e.target.id] = hotkey;
	safari.self.tab.dispatchMessage('saveTPOverrideKey', message);
	e.target.value = populateHotkeyInput(e.target.id);
}
function setControlValue(cid, value) {
	try {
		var control = document.getElementById(cid);
		if (control.type === 'checkbox') {
			control.checked = value;
		} else {		// control is a <select>
			var stringValue = (
				value === null      ? ''  :
				value === undefined ? '?' :
				value + ''
			);
			for (var i=0; i < control.options.length; i++) {
				if (control.options[i].value == stringValue) {
					control.selectedIndex = i;
					break;
				}
			}
		}
	} catch (e) {
		// console.log(e);
	}
};
function submitGlobalPref() {
	var prefs = {};
	var prefName = event.target.id;
	prefs[prefName] = getSetting(prefName);
	console.log('Submitting global pref: ', prefName, prefs[prefName]);
	safari.self.tab.dispatchMessage('saveGlobalPrefs', prefs);
}
function submitSitePref() {
	var prefs = { hostname: settings.hostname };
	var prefName = event.target.id.replace(/^site\./, '');
	prefs[prefName] = getSetting(event.target.id);
	console.log('Submitting site pref: ', prefName, prefs[prefName]);
	safari.self.tab.dispatchMessage('saveSitePrefs', prefs);
}
function submitUrlFilters() {
	safari.self.tab.dispatchMessage('saveUrlFilters', document.getElementById('filterArea').value);
}
