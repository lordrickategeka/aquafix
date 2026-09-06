import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

/* Release signing. android/key.properties and the keystore it points at are
   both gitignored, so a fresh clone will not have them — in that case the
   release build falls back to the debug key rather than failing, which keeps
   `flutter run --release` working for anyone who only wants to try the app.
   Anything actually distributed must be signed with the real key: Android
   identifies an app by its signature, and an update signed with a different
   one will not install over it. */
val keystoreProperties = Properties().apply {
    val file = rootProject.file("key.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val hasReleaseKey = keystoreProperties.getProperty("storeFile") != null

android {
    namespace = "ug.or.kuwe.kuwe_meter"
    // Pinned rather than flutter.compileSdkVersion (37). The SDK manager on
    // this machine installed API 37 with AndroidVersion.ApiLevel=37.0, so it
    // sits in platforms/android-37.0 and Gradle's lookup for "android-37"
    // fails. 36 is installed correctly and every plugin here builds against
    // it. Raise this once the SDK ships a well-formed android-37.
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "ug.or.kuwe.kuwe_meter"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName(if (hasReleaseKey) "release" else "debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
