# ERA shared example resources

Private, dependency-free author HTML resources shared by Service initialization and the UI editor. Keep one template source in `index.js`.

After a resource change, run `npm pack` in this directory and reinstall the local tarball dependencies in `app` and `javascript_project/service`. Rebuild Service AOT and the App bundle. Webpack must bundle this private package locally; it is not a published CDN module.
