import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// The upload key signs what goes to Google Play, and it is never in the
// repository: `android/key.properties`, which git ignores, says where the
// keystore is and what opens it. See «Google Play» in app/README.md.
val uploadKey = rootProject.file("key.properties").takeIf { it.exists() }?.let { file ->
    Properties().apply { file.inputStream().use { load(it) } }
}

android {
    namespace = "app.swaply.swaply_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // The same id as the iOS bundle. Google Play ties it to the app for
        // good at the first upload, so it is not to be changed after that.
        applicationId = "no.teorimester.swaply"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (uploadKey != null) {
            create("upload") {
                storeFile = file(uploadKey.getProperty("storeFile"))
                storePassword = uploadKey.getProperty("storePassword")
                keyAlias = uploadKey.getProperty("keyAlias")
                keyPassword = uploadKey.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Without the upload key a release build is signed with the debug
            // key, so `flutter run --release` still works on any machine.
            signingConfig = signingConfigs.getByName(if (uploadKey != null) "upload" else "debug")
        }
    }
}

// An .aab is only ever built to be uploaded, and Google Play refuses one signed
// with the debug key. Better to say so before the build than after the upload.
gradle.taskGraph.whenReady {
    if (uploadKey == null && allTasks.any { it.name == "bundleRelease" }) {
        throw GradleException(
            "There is no android/key.properties, so no upload key to sign the .aab with. " +
                "See «Google Play» in app/README.md.",
        )
    }
}

flutter {
    source = "../.."
}
