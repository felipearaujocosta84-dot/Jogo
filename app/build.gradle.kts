plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.ps5launcher"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.ps5launcher"
        minSdk = 26          // Android 8.0 ou superior
        targetSdk = 35
        versionCode = 2
        versionName = "1.1"
    }

    // Chave de assinatura própria do projeto. Assim, cada nova versão do APK
    // instala por cima da anterior sem perder suas configurações.
    signingConfigs {
        create("launcher") {
            storeFile = rootProject.file("keystore/ps5launcher.jks")
            storePassword = "ps5launcher123"
            keyAlias = "ps5launcher"
            keyPassword = "ps5launcher123"
        }
    }

    buildTypes {
        release {
            // Encolhe e otimiza o APK (importante para celulares de entrada).
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("launcher")
        }
        debug {
            signingConfig = signingConfigs.getByName("launcher")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
    lint {
        // Evita que avisos de estilo bloqueiem a geração do APK.
        abortOnError = false
        checkReleaseBuilds = false
    }
    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.animation:animation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
}
