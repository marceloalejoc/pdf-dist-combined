/* Copyright 2017 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FirefoxCom = exports.DownloadManager = undefined;

var _pdfjs = require('pdfjs-web/pdfjs');

var _app = require('pdfjs-web/app');

var _preferences = require('pdfjs-web/preferences');

{
  throw new Error('Module "pdfjs-web/firefoxcom" shall not be used outside ' + 'FIREFOX and MOZCENTRAL builds.');
}
var FirefoxCom = function FirefoxComClosure() {
  return {
    requestSync: function (action, data) {
      var request = document.createTextNode('');
      document.documentElement.appendChild(request);
      var sender = document.createEvent('CustomEvent');
      sender.initCustomEvent('pdf.js.message', true, false, {
        action: action,
        data: data,
        sync: true
      });
      request.dispatchEvent(sender);
      var response = sender.detail.response;
      document.documentElement.removeChild(request);
      return response;
    },
    request: function (action, data, callback) {
      var request = document.createTextNode('');
      if (callback) {
        document.addEventListener('pdf.js.response', function listener(event) {
          var node = event.target;
          var response = event.detail.response;
          document.documentElement.removeChild(node);
          document.removeEventListener('pdf.js.response', listener);
          return callback(response);
        });
      }
      document.documentElement.appendChild(request);
      var sender = document.createEvent('CustomEvent');
      sender.initCustomEvent('pdf.js.message', true, false, {
        action: action,
        data: data,
        sync: false,
        responseExpected: !!callback
      });
      return request.dispatchEvent(sender);
    }
  };
}();
var DownloadManager = function DownloadManagerClosure() {
  function DownloadManager() {}
  DownloadManager.prototype = {
    downloadUrl: function DownloadManager_downloadUrl(url, filename) {
      FirefoxCom.request('download', {
        originalUrl: url,
        filename: filename
      });
    },
    downloadData: function DownloadManager_downloadData(data, filename, contentType) {
      var blobUrl = (0, _pdfjs.createObjectURL)(data, contentType, false);
      FirefoxCom.request('download', {
        blobUrl: blobUrl,
        originalUrl: blobUrl,
        filename: filename,
        isAttachment: true
      });
    },
    download: function DownloadManager_download(blob, url, filename) {
      var blobUrl = window.URL.createObjectURL(blob);
      FirefoxCom.request('download', {
        blobUrl: blobUrl,
        originalUrl: url,
        filename: filename
      }, function response(err) {
        if (err && this.onerror) {
          this.onerror(err);
        }
        window.URL.revokeObjectURL(blobUrl);
      }.bind(this));
    }
  };
  return DownloadManager;
}();
_preferences.Preferences._writeToStorage = function (prefObj) {
  return new Promise(function (resolve) {
    FirefoxCom.request('setPreferences', prefObj, resolve);
  });
};
_preferences.Preferences._readFromStorage = function (prefObj) {
  return new Promise(function (resolve) {
    FirefoxCom.request('getPreferences', prefObj, function (prefStr) {
      var readPrefs = JSON.parse(prefStr);
      resolve(readPrefs);
    });
  });
};
(function listenFindEvents() {
  var events = ['find', 'findagain', 'findhighlightallchange', 'findcasesensitivitychange'];
  var handleEvent = function (evt) {
    if (!_app.PDFViewerApplication.initialized) {
      return;
    }
    _app.PDFViewerApplication.eventBus.dispatch('find', {
      source: window,
      type: evt.type.substring('find'.length),
      query: evt.detail.query,
      phraseSearch: true,
      caseSensitive: !!evt.detail.caseSensitive,
      highlightAll: !!evt.detail.highlightAll,
      findPrevious: !!evt.detail.findPrevious
    });
  };
  for (var i = 0, len = events.length; i < len; i++) {
    window.addEventListener(events[i], handleEvent);
  }
})();
function FirefoxComDataRangeTransport(length, initialData) {
  _pdfjs.PDFDataRangeTransport.call(this, length, initialData);
}
FirefoxComDataRangeTransport.prototype = Object.create(_pdfjs.PDFDataRangeTransport.prototype);
FirefoxComDataRangeTransport.prototype.requestDataRange = function FirefoxComDataRangeTransport_requestDataRange(begin, end) {
  FirefoxCom.request('requestDataRange', {
    begin: begin,
    end: end
  });
};
FirefoxComDataRangeTransport.prototype.abort = function FirefoxComDataRangeTransport_abort() {
  FirefoxCom.requestSync('abortLoading', null);
};
_app.PDFViewerApplication.externalServices = {
  updateFindControlState: function (data) {
    FirefoxCom.request('updateFindControlState', data);
  },
  initPassiveLoading: function (callbacks) {
    var pdfDataRangeTransport;
    window.addEventListener('message', function windowMessage(e) {
      if (e.source !== null) {
        console.warn('Rejected untrusted message from ' + e.origin);
        return;
      }
      var args = e.data;
      if (typeof args !== 'object' || !('pdfjsLoadAction' in args)) {
        return;
      }
      switch (args.pdfjsLoadAction) {
        case 'supportsRangedLoading':
          pdfDataRangeTransport = new FirefoxComDataRangeTransport(args.length, args.data);
          callbacks.onOpenWithTransport(args.pdfUrl, args.length, pdfDataRangeTransport);
          break;
        case 'range':
          pdfDataRangeTransport.onDataRange(args.begin, args.chunk);
          break;
        case 'rangeProgress':
          pdfDataRangeTransport.onDataProgress(args.loaded);
          break;
        case 'progressiveRead':
          pdfDataRangeTransport.onDataProgressiveRead(args.chunk);
          break;
        case 'progress':
          callbacks.onProgress(args.loaded, args.total);
          break;
        case 'complete':
          if (!args.data) {
            callbacks.onError(args.errorCode);
            break;
          }
          callbacks.onOpenWithData(args.data);
          break;
      }
    });
    FirefoxCom.requestSync('initPassiveLoading', null);
  },
  fallback: function (data, callback) {
    FirefoxCom.request('fallback', data, callback);
  },
  reportTelemetry: function (data) {
    FirefoxCom.request('reportTelemetry', JSON.stringify(data));
  },
  createDownloadManager: function () {
    return new DownloadManager();
  },
  get supportsIntegratedFind() {
    var support = FirefoxCom.requestSync('supportsIntegratedFind');
    return (0, _pdfjs.shadow)(this, 'supportsIntegratedFind', support);
  },
  get supportsDocumentFonts() {
    var support = FirefoxCom.requestSync('supportsDocumentFonts');
    return (0, _pdfjs.shadow)(this, 'supportsDocumentFonts', support);
  },
  get supportsDocumentColors() {
    var support = FirefoxCom.requestSync('supportsDocumentColors');
    return (0, _pdfjs.shadow)(this, 'supportsDocumentColors', support);
  },
  get supportedMouseWheelZoomModifierKeys() {
    var support = FirefoxCom.requestSync('supportedMouseWheelZoomModifierKeys');
    return (0, _pdfjs.shadow)(this, 'supportedMouseWheelZoomModifierKeys', support);
  }
};
document.mozL10n.setExternalLocalizerServices({
  getLocale: function () {
    return FirefoxCom.requestSync('getLocale', null);
  },
  getStrings: function (key) {
    return FirefoxCom.requestSync('getStrings', key);
  }
});
exports.DownloadManager = DownloadManager;
exports.FirefoxCom = FirefoxCom;