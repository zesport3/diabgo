/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "402b66900e731ca748771b6fc5e7a068"
  }, {
    "url": "pwa-512x512.png",
    "revision": "3cd06ebaebb80acfac0b26c9ae92e89b"
  }, {
    "url": "pwa-192x192.png",
    "revision": "a0cab350893936ad167b93efe280092b"
  }, {
    "url": "index.html",
    "revision": "b55d1b67556f529de68241dc404985f8"
  }, {
    "url": "icon.svg",
    "revision": "1b20d2ef6b3112db4b03220cde3b822a"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "34439ce04073dc89cd24ed99e08276a6"
  }, {
    "url": "assets/purify.es-BZxk_wWO.js",
    "revision": null
  }, {
    "url": "assets/index.es-C49ktrVh.js",
    "revision": null
  }, {
    "url": "assets/index-tdIvzBdB.css",
    "revision": null
  }, {
    "url": "assets/index-DA4edgds.js",
    "revision": null
  }, {
    "url": "assets/html2canvas-CEB1Mlpu.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "34439ce04073dc89cd24ed99e08276a6"
  }, {
    "url": "icon.svg",
    "revision": "1b20d2ef6b3112db4b03220cde3b822a"
  }, {
    "url": "pwa-192x192.png",
    "revision": "a0cab350893936ad167b93efe280092b"
  }, {
    "url": "pwa-512x512.png",
    "revision": "3cd06ebaebb80acfac0b26c9ae92e89b"
  }, {
    "url": "manifest.webmanifest",
    "revision": "91fcd102522927dc6ed22f32250aa8bd"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
