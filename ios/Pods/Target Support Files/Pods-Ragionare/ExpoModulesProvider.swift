/**
 * Automatically generated by expo-modules-autolinking.
 *
 * This autogenerated class provides a list of classes of native Expo modules,
 * but only these that are written in Swift and use the new API for creating Expo modules.
 */

import ExpoModulesCore
import Expo
import EXApplication
import ExpoAsset
import ExpoBackgroundFetch
import ExpoBlur
import EXConstants
import ExpoDevice
import ExpoDocumentPicker
import EASClient
import ExpoFileSystem
import ExpoFont
import ExpoHaptics
import ExpoKeepAwake
import ExpoLinking
import ExpoHead
import ExpoSplashScreen
import ExpoSymbols
import ExpoSystemUI
import EXUpdates
import ExpoWebBrowser
#if EXPO_CONFIGURATION_DEBUG
import EXDevLauncher
import EXDevMenu
#endif

@objc(ExpoModulesProvider)
public class ExpoModulesProvider: ModulesProvider {
  public override func getModuleClasses() -> [AnyModule.Type] {
    #if EXPO_CONFIGURATION_DEBUG
    return [
      ExpoFetchModule.self,
      ApplicationModule.self,
      AssetModule.self,
      BackgroundFetchModule.self,
      BlurViewModule.self,
      ConstantsModule.self,
      DeviceModule.self,
      DocumentPickerModule.self,
      EASClientModule.self,
      FileSystemModule.self,
      FileSystemNextModule.self,
      FontLoaderModule.self,
      HapticsModule.self,
      KeepAwakeModule.self,
      ExpoLinkingModule.self,
      ExpoHeadModule.self,
      SplashScreenModule.self,
      SymbolModule.self,
      ExpoSystemUIModule.self,
      UpdatesModule.self,
      WebBrowserModule.self,
      DevLauncherInternal.self,
      DevLauncherAuth.self,
      RNCSafeAreaProviderManager.self,
      DevMenuModule.self,
      DevMenuInternalModule.self,
      DevMenuPreferences.self,
      RNCSafeAreaProviderManager.self
    ]
    #else
    return [
      ExpoFetchModule.self,
      ApplicationModule.self,
      AssetModule.self,
      BackgroundFetchModule.self,
      BlurViewModule.self,
      ConstantsModule.self,
      DeviceModule.self,
      DocumentPickerModule.self,
      EASClientModule.self,
      FileSystemModule.self,
      FileSystemNextModule.self,
      FontLoaderModule.self,
      HapticsModule.self,
      KeepAwakeModule.self,
      ExpoLinkingModule.self,
      ExpoHeadModule.self,
      SplashScreenModule.self,
      SymbolModule.self,
      ExpoSystemUIModule.self,
      UpdatesModule.self,
      WebBrowserModule.self
    ]
    #endif
  }

  public override func getAppDelegateSubscribers() -> [ExpoAppDelegateSubscriber.Type] {
    #if EXPO_CONFIGURATION_DEBUG
    return [
      FileSystemBackgroundSessionHandler.self,
      LinkingAppDelegateSubscriber.self,
      ExpoHeadAppDelegateSubscriber.self,
      SplashScreenAppDelegateSubscriber.self,
      ExpoDevLauncherAppDelegateSubscriber.self
    ]
    #else
    return [
      FileSystemBackgroundSessionHandler.self,
      LinkingAppDelegateSubscriber.self,
      ExpoHeadAppDelegateSubscriber.self,
      SplashScreenAppDelegateSubscriber.self
    ]
    #endif
  }

  public override func getReactDelegateHandlers() -> [ExpoReactDelegateHandlerTupleType] {
    #if EXPO_CONFIGURATION_DEBUG
    return [
      (packageName: "expo-updates", handler: ExpoUpdatesReactDelegateHandler.self),
      (packageName: "expo-dev-launcher", handler: ExpoDevLauncherReactDelegateHandler.self),
      (packageName: "expo-dev-menu", handler: ExpoDevMenuReactDelegateHandler.self)
    ]
    #else
    return [
      (packageName: "expo-updates", handler: ExpoUpdatesReactDelegateHandler.self)
    ]
    #endif
  }

  public override func getAppCodeSignEntitlements() -> AppCodeSignEntitlements {
    return AppCodeSignEntitlements.from(json: #"{}"#)
  }
}
