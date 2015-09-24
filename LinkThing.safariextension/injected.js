HTMLAnchorElement.prototype.handleKeyUp = function (e) {
	switch (e.keyCode) {
		case settings.tpoKeyLeftmost.keyCode  : positionOverride = { ps: -2, fr: e.shiftKey }; break;
		case settings.tpoKeyLeft.keyCode      : positionOverride = { ps:  0, fr: e.shiftKey }; break;
		case settings.tpoKeyRight.keyCode     : positionOverride = { ps:  1, fr: e.shiftKey }; break;
		case settings.tpoKeyRightmost.keyCode : positionOverride = { ps: -1, fr: e.shiftKey }; break;
		case settings.tpoKeyCurrent.keyCode   : positionOverride = { ps: null }; break;
		default: return;
	}
	if (positionOverride.ps === undefined) {
		return;
	}
	if (settings.tpOverrideKeyClicks) {
		var ps = positionOverride.ps;
		if (ps == 1) {
			positionOverride.ps = null;
			var evt = new MouseEvent('click', {
				button   : 0,
				metaKey  : ps !== null,
				shiftKey : positionOverride.fr
			});
			this.dispatchEvent(evt);
		}
		else if (ps === null) {
			window.location.href = this.href;
		}
		else {
			var message = {
				href            : this.href,
				tpo             : positionOverride || {},
				shift           : e.shiftKey,
				option          : e.altKey,
				positionSetting : positionOverride.ps,
				settings        : settings 
			};
			safari.self.tab.dispatchMessage('handleLinkKick', message);
		}
	}
	if (hrefRevealer) {
		var statusText = this.href;
		var targetText = (
			positionOverride.ps == -2   ? 'new leftmost'  :
			positionOverride.ps ==  0   ? 'new left'      :
			positionOverride.ps ==  1   ? 'new right'     :
			positionOverride.ps == -1   ? 'new rightmost' :
			positionOverride.ps == null ? 'this'          : ''
		);
		var focusText = (positionOverride.ps == null || (settings.focusLinkTarget ^ e.shiftKey)) ? '' : ' background';
		statusText += ' (opens in ' + targetText + focusText + ' tab)';
		hrefRevealer.say(statusText);
	}
}
HTMLAnchorElement.prototype.isBlacklisted = function () {
	return settings.linkBlacklist.some(matches, this.href) || settings.downloadPatterns.some(matches, this.href);
};
HTMLAnchorElement.prototype.isEligible = function () {
	var link = this;
	var tgt = link.target;
	if (link.getAttribute('href') == '#') return false;
	if (!(/^http/).test(link.protocol))   return false;
	if (tgt && contains(frameNames, tgt)) return false;
	if (link.isBlacklisted())             return false;
	if (link.isTargetingExempt())         return false;
	return true;
};
HTMLAnchorElement.prototype.isTargetingExempt = function () {
	var exemptClasses = [
		'floatbox','greybox','highslide','lightwindow','lbOn','lightview',
		'sexylightbox','smoothbox','submodal','thickbox'
	];
	var exemptRels = [
		'lightbox','lytebox','lyteshow','lyteframe','facebox','gb_image','gb_page','imagezoom',
		'thickbox','prettyPhoto','lighterbox','milkbox','shadowbox','rokbox','gallery'
	];
	var exemptRoles = [
		'button','presentation'
	];
	this.role = this.getAttribute('role');
	if (this.className && contains(exemptClasses, this.className)) return true;
	if (this.rel       && contains(exemptRels   , this.rel      )) return true;
	if (this.role      && contains(exemptRoles  , this.role     )) return true;
	return false;
};
HTMLAnchorElement.prototype.isOffsite = function () {
	if (this.host != window.location.host) {
		return true;
	} else if (gHostnameRe.test(location.hostname) && this.className == 'l') {
		return true;
	} else return false;
};
HTMLAnchorElement.prototype.processLinkClick = function (e) {
	var link = this;
	var modkeys = e.shiftKey * 1 + e.ctrlKey * 2 + e.altKey * 4 + e.metaKey * 8;
	if (modkeys == 1 || modkeys == 4 || modkeys == 5)
		return;
	if (link.isEligible()) {
		if (rewriteGoogleLinks) {
			if (link.pathname == '/url') {
				if ((/[?&]url=[^&]+/).test(link.search)) {
					link.href = decodeURIComponent(link.search.split(/[?&]url=/)[1].split('&')[0]);
				}
			}
		}
		if (link.willKick(e, true)) {
			var background = !(e.shiftKey ^ settings.focusLinkTarget);
			var positionSetting = (positionOverride.ps !== undefined) 
				? positionOverride.ps 
				: (background ? settings.newBgTabPosition : settings.newTabPosition);
			if (positionSetting !== null) {
				e.stopPropagation();
				e.preventDefault();
				var message = {
					href            : link.href,
					tpo             : positionOverride || {},
					shift           : e.shiftKey,
					option          : e.altKey,
					positionSetting : positionSetting,
					settings        : settings 
				};
				safari.self.tab.dispatchMessage('handleLinkKick', message);
			}
			positionOverride = {};
			handleMouseOutOfLink(e);
		} else {
			if (positionOverride.ps === null) {
				link.setTempTarget('_top', 100);
			} else
			if (e.metaKey) {
				e.preventDefault();
				if (selfIsReader) {
					safari.self.tab.dispatchMessage('loadInMyTab', link.href);
				} else {
					window.location.href = link.href;
				}
			} else {
				if (['_self','_parent','_top'].indexOf(link.target) < 0) {
					link.setTempTarget('_top', 100);
				} else {
					handleMouseOutOfLink(e);
				}
			}
		}
	} else {
		if (settings.downloadPatterns.some(matches, link.href)) {
			link.target = '';
		}
	}
}
HTMLAnchorElement.prototype.setTempTarget = function (target, duration) {
	var link = this;
	var oldTarget = link.target;
	link.target = target;
	setTimeout(function () {
		link.target = oldTarget;
	}, duration);
};
HTMLAnchorElement.prototype.willKick = function (e, testedEligible) {
	var targetKick = !contains(['','_self','_parent','_top'], this.target);
	if (testedEligible || this.isEligible()) {
		if (e.metaKey && e.shiftKey)
			return true;
		if (positionOverride.ps === null)
			return false;
		else if (positionOverride.ps !== undefined)
			return true;
		var samePage = (this.href.split('#')[0] == location.href.split('#')[0]) && !(/^\#\!/).test(this.hash);
		var kickPref = (this.isOffsite() ? settings.kickOffLinks : settings.kickOnLinks);
		if (kickPref == 1 && samePage)
			kickPref = 0;
		var wouldKick = (
		    selfIsReader   ? true  :
			kickPref ==  1 ? true  :  // if not reversed, link opens in new tab
			kickPref == -1 ? false :  // if not reversed, link opens in this tab
			targetKick                // if not reversed, site will decide
		);
		var reversal = (
			e.button == 0 ?  e.metaKey :
			e.button == 1 ? !e.metaKey :
			e.button == 2 ? true       :
			e.metaKey
		);
		var conclusion = (settings.cmdClickIgnoresTarget) ? (wouldKick || reversal) : !!(wouldKick ^ reversal);
		return conclusion;
	} else {
		if (settings.downloadPatterns.some(matches, this.href))
			return false;
		return targetKick || (e.metaKey || e.button == 2);
	}
};

function StatusBox(msg, mx, my) {
	var sb = document.createElement('div');
	sb.show = function () {
		document.documentElement.appendChild(this);
		setTimeout(function () { sb.style.opacity = '1'; }, 0);
		if ((window.innerHeight - bottomOffset - my < this.offsetHeight + 5) && (mx < this.offsetWidth + 5)) {
			this.style.top = '0';
			this.style.bottom = 'auto';
			this.style.borderStyle = 'none solid solid none';
			this.style.borderRadius = '0 0 4px 0';
		}
		return this;
	};
	sb.say = function (msg) {
		this.textContent = msg;
	};
	sb.destroy = function () {
		document.documentElement.removeChild(sb);
		hrefRevealer = null;
	};
	sb.style.display = 'block';
	sb.style.position = 'fixed';
	sb.style.zIndex = '2147483647';
	sb.style.left = '0';
	sb.style.top = 'auto';
	sb.style.bottom = bottomOffset + 'px';
	sb.style.width = 'auto';
	sb.style.height = 'auto';
	sb.style.maxWidth = window.innerWidth - 8 + 'px';
	sb.style.overflow = 'hidden';
	sb.style.margin = 0;
	sb.style.borderStyle = 'solid solid none none';
	sb.style.borderWidth = '1px';
	sb.style.borderRadius = '0 4px 0 0';
	sb.style.borderColor = '#999';
	sb.style.backgroundColor = '#e3e3e3';
	sb.style.padding = '1px 5px 3px 5px';
	sb.style.whiteSpace = 'nowrap';
	sb.style.textOverflow = 'ellipsis';
	sb.style.color = 'black';
	sb.style.font = 'normal normal normal 11px/normal "Lucida Grande", sans-serif';
	sb.style.opacity = '0';
	sb.style.transition = 'opacity 0.2s ease-in-out';
	sb.textContent = msg;
	return sb;
}
function clearScrolling() {
	window.scrolling = false;
}
function contains(array, thing) {
	return array.indexOf(thing) >= 0;
}
function handleClick(e) {
	if (siteIsBlacklisted || e.ctrlKey) return;
	var node = e.target;
	if (node == document.documentElement) return;
	while (node.href == undefined && node.parentNode) {
		node = node.parentNode;
	}
	if (node.href) {
		node.processLinkClick(e);
	}
}
function handleContextMenu(e) {
	var userInfo = {
		x: e.clientX,
		y: e.clientY
	};
	var node = e.target;
	while (node.href == undefined && node.parentNode) {
		node = node.parentNode;
	}
	if (!selfIsReader) {
		if (node.href) {
			userInfo.url = node.href;
			userInfo.ref = document.location.href;
			userInfo.tit = document.title;
		}
		safari.self.tab.setContextMenuEventUserInfo(event, userInfo);
	}
	if (!siteIsBlacklisted) {
		if (node.href && !e.ctrlKey && settings.rightClickForCmdClick) {
			window.getSelection().empty();
			e.preventDefault();
			var click = document.createEvent('MouseEvents');
			click.initMouseEvent(
				'click', true, true, window, 0, e.screenX, e.screenY, e.clientX, e.clientY, 
				false, false, e.shiftKey, true, 0, null
			);
			node.dispatchEvent(click);
		}
	}
}
function handleMessage(e) {
	switch (e.name) {
		case 'receiveSettings': 
			if (e.message.hostname == window.location.hostname || e.message.hostname == '*') {
				// console.log('Received LinkThing settings for hostname ' + e.message.hostname, e.message);
				for (var key in e.message) {
					settings[key] = e.message[key];
				}
				if (settings.blacklistStatus !== undefined) {
					siteIsBlacklisted = (settings.blacklistStatus > 0);
					// document.removeEventListener('mouseover', handleMouseOver, false);
					document.removeEventListener('click', handleClick, true);
					if (!siteIsBlacklisted) {
						// document.addEventListener('mouseover', handleMouseOver, false);
						document.addEventListener('click', handleClick, true);
					}
				}
				if (settings.rewriteGoogleLinks !== undefined) {
					rewriteGoogleLinks = settings.rewriteGoogleLinks && gHostnameRe.test(location.hostname)
				}
				if (settings.showLinkHrefs !== undefined) {
					document.removeEventListener('scroll', handleScroll, false);
					if (settings.showLinkHrefs) {
						showLinkHrefs = settings.showLinkHrefs && !window.statusbar.visible;
						document.addEventListener('scroll', handleScroll, false);
					}
				}
			} break;
		case 'showHrefBox': 
			if (winIsTop) {
				hrefRevealer = new StatusBox(e.message.msgStr, e.message.mouseX, e.message.mouseY).show();
			} break;
		case 'hideHrefBox': 
			winIsTop && hrefRevealer && hrefRevealer.destroy();
			break;
		case 'showPrefsBox': 
			if (winIsTop) {
				showPrefsBox(e.message);
			} break;
		case 'closePrefsBox': 
			var prefsBox = document.getElementById('cksle_prefsBox');
			winIsTop && prefsBox && document.documentElement.removeChild(prefsBox);
			break;
		case 'ipAddState': 
			if (winIsTop) {
				setIpAddIndicator(e.message);
			} break;
		case 'giveMeYourWindowName': 
			if (window.name && window.name != e.message)
				safari.self.tab.dispatchMessage('myWindowNameIs', {
					framename : window.name,
					requester : e.message,
				});
			break;
		case 'youHaveAFellowFrameNamed:': 
			if (window.name == e.message.requester) {
				if (frameNames.indexOf(e.message.framename) == -1)	{
					frameNames.push(e.message.framename);
					// console.log('frames:', frameNames, 'this frame: "' + window.name + '"');
				}
			} break;
	}
}
function handleMouseOutOfLink(e) {
	if (revealWaiter) {
		clearTimeout(revealWaiter);
		revealWaiter = null;
	}
	e.target.removeEventListener(e.type, handleMouseOutOfLink, false);
	if (e.type != 'mouseout')
		e.target.removeEventListener('mouseout', handleMouseOutOfLink, false);
	if (winIsTop) {
		hrefRevealer && hrefRevealer.destroy();
	} else {
		safari.self.tab.dispatchMessage('handleLinkMouseOut');
	}
}
function handleMouseOver(e) {
	if (window.scrolling) return;
	var et = e.target, lc = -1;
	while (et && !(et instanceof HTMLAnchorElement) && (2 > ++lc))
		et = et.parentElement;
	if (!et || !et.href) return;
	var link = et;
	if (showLinkHrefs) {
		link.addEventListener('mouseout', handleMouseOutOfLink, false);
		document.addEventListener('click', handleMouseOutOfLink, false);
		revealWaiter || (revealWaiter = setTimeout(revealHref, 100, e, link));
	}
	if (!siteIsBlacklisted) {
		if (settings.useTPOverrideKeys) {
			var handleLinkKeyDown = function (kd) {
				if (/^www\.google\.[a-z]+$/.test(location.hostname)) {
					kd.stopPropagation();
				}
			};
			var handleLinkKeyUp = function (ku) {
				if (['INPUT','BUTTON','SELECT','TEXTAREA'].indexOf(ku.target.nodeName) == -1) {
					ku.stopPropagation();
					link.handleKeyUp(ku);
				}
			};
			var cancelLinkKeyListeners = function (me) {
				positionOverride = {};
				me.currentTarget.removeEventListener(me.type, cancelLinkKeyListeners, false);
				document.removeEventListener('keydown', handleLinkKeyDown, true);
				document.removeEventListener('keyup', handleLinkKeyUp, true);
			}
			document.addEventListener('keydown', handleLinkKeyDown, true);
			document.addEventListener('keyup', handleLinkKeyUp, true);
			link.addEventListener('mouseout', cancelLinkKeyListeners, false);
			// link.addEventListener('mousedown', cancelLinkKeyListeners, false);
		}
		if (rewriteGoogleLinks && link.getAttribute('onmousedown')) {
			link.removeAttribute('onmousedown');
			link.addEventListener('mousedown', function handleMouseDown(md) {
				md.stopPropagation();
				link.removeEventListener('mousedown', handleMouseDown, false);
			}, true);
			if (link.pathname == '/url') {
				if ((/[?&]url=[^&]+/).test(link.search)) {
					link.href = decodeURIComponent(link.search.split(/[?&]url=/)[1].split('&')[0]);
				}
			}
		}
	}
}
function handleScroll(e) {
	if (window.scrolling) return;
	window.scrolling = true;
	setTimeout(clearScrolling, 100);
}
function logGlobal(msg) {
	safari.self.tab.dispatchMessage('logThis', msg);
}
function matches(re) {
	return re.test(this);
}
function revealHref(evt, link) {
	revealWaiter = null;
	var modkeys = evt.shiftKey * 1 + evt.ctrlKey * 2 + evt.altKey * 4 + evt.metaKey * 8;
	var statusText = '';
	if (modkeys == 1) {
		statusText = 'Add "' + link.href + '" to Reading List';
	} else 
	if (modkeys == 4 || modkeys == 5) {
		statusText = 'Download "' + link.href + '"';
	} else {
		statusText = link.href;
		var background, kickTest;
		if (siteIsBlacklisted) {
			background = evt.shiftKey;
			kickTest = evt.metaKey;
		} else {
			background = !(evt.shiftKey ^ settings.focusLinkTarget) || selfIsReader;
			kickTest = link.willKick(evt);
		}
		if (link.target && frameNames.indexOf(link.target) > -1) {
			statusText += ' (opens in "' + link.target + '")';
		} else if (kickTest) {
			statusText += ' (opens in new' + (background ? ' background ' : ' ') + (evt.altKey ? 'window)' : 'tab)');
		}
	}
	if (winIsTop) {
		hrefRevealer = new StatusBox(statusText, evt.clientX, evt.clientY).show();
	} else {
		var message = { msgStr: statusText, mouseX: evt.clientX, mouseY: evt.clientY };
		safari.self.tab.dispatchMessage('handleLinkMouseOver', message);
	}
}
function setIpAddIndicator(state) {
	if (state == 'saving') {
		var ipaiBox = document.createElement('div');
		ipaiBox.w = 96;
		ipaiBox.h = 72;
		ipaiBox.id = 'cksle_ipaiBox';
		ipaiBox.setAttribute('style', '\
			display: -webkit-box;\
			-webkit-box-orient: vertical;\
			-webkit-box-pack: center;\
			position: fixed;\
			z-index: 2147483647;\
			margin: 0; padding: 0;\
			border: 1px solid #444;\
			border-radius: 5px;\
			background: -webkit-gradient(linear, 0% 0%, 0% 100%, from(white), to(#F4F4F4));\
			text-align: center;\
			color: black;\
		');
		ipaiBox.style.left = window.innerWidth/2  - ipaiBox.w/2 + 'px';
		ipaiBox.style.top  = window.innerHeight/2 - ipaiBox.h/2 + 'px';
		ipaiBox.style.width = ipaiBox.w + 'px';
		ipaiBox.style.height = ipaiBox.h + 'px';
		
		var ipaiIcon = document.createElement('img');
		ipaiIcon.id = 'cksle_ipaiIcon';
		ipaiIcon.src = safari.extension.baseURI + 'saving.gif';
		ipaiBox.appendChild(ipaiIcon);
		
		ipaiBox.appendChild(document.createElement('br'));
		
		var ipaiText = document.createElement('span');
		ipaiText.id = 'cksle_ipaiText';
		ipaiText.setAttribute('style', '\
			position: relative;\
			top: 6px;\
			font: normal 13px/normal "Helvetica Neue", Helvetica, sans-serif;\
		');
		ipaiText.textContent = 'Saving...';
		ipaiBox.appendChild(ipaiText);
		
		document.documentElement.appendChild(ipaiBox);
	}
	else if (state == 'saved') {
		var ipaiBox = document.getElementById('cksle_ipaiBox');
		var ipaiIcon = document.getElementById('cksle_ipaiIcon');
		var ipaiText = document.getElementById('cksle_ipaiText');
		ipaiIcon.src = safari.extension.baseURI + 'saved.png';
		ipaiText.textContent = 'Saved!';
		ipaiText.style.color = 'green';
		setTimeout(function() {
			var ibo = 10;
			var iv = setInterval(function() {
				ibo -= 2;
				ipaiBox.style.opacity = ibo/10 + '';
				if (ibo == 0) {
					clearInterval(iv);
					document.documentElement.removeChild(ipaiBox);
				}
			}, 50);
		}, 1000);
	}
	else if (state == 'failed') {
		var ipaiBox = document.getElementById('cksle_ipaiBox');
		document.documentElement.removeChild(ipaiBox);
	}
}
function showPrefsBox(coords) {
	if (document.getElementById('cksle_prefsBox')) {
		document.documentElement.removeChild(document.getElementById('cksle_prefsBox'));
	}
	var prefsBox = document.createElement('iframe');
	prefsBox.width  = 480;
	prefsBox.height = 446;
	prefsBox.left   = window.innerWidth/2 - prefsBox.width/2;
	prefsBox.top    = 32;
	if (coords) {
		prefsBox.left = coords.x - prefsBox.width/2;
		if (prefsBox.left < 20) {
			prefsBox.left = 20;
		} else if (prefsBox.left + prefsBox.width*1 + 20 > window.innerWidth) {
			prefsBox.left = window.innerWidth - prefsBox.width - 20;
		}
		prefsBox.top = coords.y;
		if (prefsBox.top < 20) {
			prefsBox.top = 20;
		} else if (prefsBox.top + prefsBox.height*1 + 20 > window.innerHeight) {
			prefsBox.top = window.innerHeight - prefsBox.height - 20;
		}
	}
	prefsBox.id = 'cksle_prefsBox';
	prefsBox.name = 'cksle_prefsBox';
	prefsBox.style.position = 'fixed';
	prefsBox.style.zIndex = '2147483647';
	prefsBox.style.left = prefsBox.left + 'px';
	prefsBox.style.top = prefsBox.top + 'px';
	prefsBox.style.width = prefsBox.width + 'px';
	prefsBox.style.height = prefsBox.height + 'px';
	prefsBox.style.opacity = '1';
	prefsBox.style.borderStyle = 'none';
	prefsBox.style.borderRadius = '5px';
	prefsBox.style.boxShadow = '#222 0px 10px 32px';
	prefsBox.scrolling = 'no';
	prefsBox.src = safari.extension.baseURI + 'siteprefs.html';
	document.documentElement.appendChild(prefsBox);
	prefsBox.focus();
	window.addEventListener('click', function requestClose(e) {
		var prefsBox = document.getElementById('cksle_prefsBox');
		prefsBox && document.documentElement.removeChild(prefsBox);
		window.removeEventListener('click', requestClose, false);
	}, false);
}

var settings          = {};
var frameNames        = (window.name) ? [window.name] : [];
var showLinkHrefs     = false;
var hrefRevealer      = null;
var revealWaiter      = null;
var siteIsBlacklisted = false;
var selfIsReader      = location.protocol == 'safari-reader:';
var winIsTop          = (window == window.top);
var bottomOffset      = (/^cksfe_fwin/).test(window.name) ? 22 : 0;
var positionOverride  = {};
var rewriteGoogleLinks;

const tpoModChars = /[AaSsDdFfJjKkLl:;]/;
const gHostnameRe = /^www\.google(\.[a-z]+)+$/;

safari.self.addEventListener('message', handleMessage, false);
safari.self.tab.dispatchMessage('passSettings', {
	url      : window.location.href,
	hostname : window.location.hostname
});
if (window.name || /developer.apple.com\/.*\/#documentation/.test(location.href))
	safari.self.tab.dispatchMessage('whoAreMyFellowFrames?', window.name);
window.addEventListener('contextmenu', handleContextMenu, false);
window.addEventListener('mouseover', handleMouseOver, false);
