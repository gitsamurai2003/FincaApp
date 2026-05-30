import 'dotenv/config'; // Asegúrate de tener instalado dotenv

export default {
  expo: {
    name: "FincaApp",
    slug: "FincaApp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logos.png",
    scheme: "fincaapp",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/logos.png",
        backgroundColor: "#065F46"
      },
      predictiveBackGestureEnabled: false,
      package: "com.adolfogf.FincaApp"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: ""
    },
    plugins: [
      "expo-router",
      "expo-sqlite",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-logo.png",
          backgroundColor: "#065F46",
          imageWidth: 300
        }
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN
        }
      ]
    ],
    extra: {
      EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
      eas: {
        projectId: "a0c29bc1-e659-4453-954f-ab516692e9cc"
      }
    }
  }
};