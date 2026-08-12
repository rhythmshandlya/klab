# k8lab brand assets

These production raster assets are generated from the selected connected-cluster identity.

- `k8lab-cluster-lockup-on-dark.png`: horizontal cluster symbol and white wordmark
- `k8lab-cluster-lockup-on-light.png`: horizontal cluster symbol and dark wordmark
- `k8lab-cluster-mark.png`: primary connected-cluster symbol with a transparent background
- `k8lab-cluster-mark-white.png`: one-color symbol for dark or blue surfaces
- `k8lab-cluster-mark-black.png`: one-color symbol for light surfaces and print
- `k8lab-cluster-app-icon.png`: 512 px application and social avatar icon on a light background
- `k8lab-app-icon-192.png`: 192 px application icon
- `k8lab-cluster-favicon.png`: transparent 64 px browser-tab icon

The browser metadata uses the transparent favicon treatment, with no dark tile behind it. The full
app icon is reserved for touch icons and social avatars. Run `python scripts/generate-brand-assets.py`
after changing the master geometry or palette.
