# TI Escala — Android

Android app that shows the TI Escala web app in a WebView.
The site is `https://ti-escala.onrender.com/` (set in `app/build.gradle.kts` as `SITE_URL`).

The selected worker ("whoami") is saved by the web app in the WebView's localStorage, so it is
kept between launches. DOM storage is enabled in `MainActivity.kt` for that reason.

## Open and run

1. Open the `android/` folder in Android Studio (Ladybug or newer).
2. Let Gradle sync. Android Studio creates `local.properties` with your SDK path.
3. Run `app` on an emulator or a phone with USB debugging on.

To build from the command line, first create the Gradle wrapper once (needs a local Gradle install):

```bash
gradle wrapper --gradle-version 8.7
./gradlew assembleDebug
```

The debug APK is written to `app/build/outputs/apk/debug/`.

## Notes

- Minimum Android version: 7.0 (API 24).
- The app uses the default system launcher icon. Replace it with a real icon in Android Studio
  (New → Image Asset) before publishing.
- The package name is `com.tiescala.app`. Change `applicationId` and `namespace` if you need another one.
