import { Capacitor } from '@capacitor/core';

export interface LaunchTarget {
  name: string;
  scheme: string;
  intent?: string; // Standard Android Intent URI
  webFallback?: string;
}

export class AppLauncher {
  private static appMappings: Record<string, LaunchTarget> = {
    youtube: {
      name: "YouTube",
      scheme: "vnd.youtube://",
      intent: "intent://www.youtube.com/#Intent;package=com.google.android.youtube;scheme=https;end",
      webFallback: "https://www.youtube.com"
    },
    whatsapp: {
      name: "WhatsApp",
      scheme: "whatsapp://",
      intent: "intent://send#Intent;package=com.whatsapp;scheme=whatsapp;end",
      webFallback: "https://web.whatsapp.com"
    },
    camera: {
      name: "Camera",
      scheme: "camera://",
      intent: "intent:#Intent;action=android.media.action.IMAGE_CAPTURE;end"
    },
    settings: {
      name: "Settings",
      scheme: "settings://",
      intent: "intent:#Intent;action=android.settings.SETTINGS;end"
    },
    gallery: {
      name: "Gallery",
      scheme: "content://media/external/images/media",
      intent: "intent:#Intent;action=android.intent.action.VIEW;type=image/*;end"
    },
    calculator: {
      name: "Calculator",
      scheme: "calculator://",
      intent: "intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_CALCULATOR;end"
    },
    gmail: {
      name: "Gmail",
      scheme: "googlegmail://",
      intent: "intent://#Intent;package=com.google.android.gm;scheme=googlegmail;end",
      webFallback: "https://mail.google.com/mail/u/0/#inbox"
    },
    chrome: {
      name: "Chrome",
      scheme: "googlechrome://",
      intent: "intent://#Intent;package=com.android.chrome;scheme=http;end",
      webFallback: "https://www.google.com"
    },
    maps: {
      name: "Google Maps",
      scheme: "geo:0,0?q=",
      intent: "intent://maps.google.com/#Intent;package=com.google.android.apps.maps;scheme=https;end",
      webFallback: "https://maps.google.com"
    },
    phone: {
      name: "Phone Dialer",
      scheme: "tel:",
      intent: "intent:#Intent;action=android.intent.action.DIAL;end"
    },
    messages: {
      name: "Messages",
      scheme: "sms:",
      intent: "intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_MESSAGING;end"
    },
    files: {
      name: "Files",
      scheme: "file://",
      intent: "intent:#Intent;action=android.intent.action.GET_CONTENT;type=*/*;end"
    }
  };

  /**
   * Attempts to launch an app by logical name.
   * Returns a status indicating if the launch succeeded or was handled.
   */
  public static async launchApp(appName: string): Promise<{
    success: boolean;
    nativeAttempt: boolean;
    targetName: string;
    message: string;
  }> {
    const key = appName.toLowerCase().trim();
    const target = this.appMappings[key];

    if (!target) {
      return {
        success: false,
        nativeAttempt: false,
        targetName: appName,
        message: `I'm sorry, bhavik, I don't have a configured profile for the app '${appName}'.`
      };
    }

    if (Capacitor.isNativePlatform()) {
      try {
        // Android WebView parses intent:// URLs beautifully and handles launching natively
        const launchUri = target.intent || target.scheme;
        console.log(`[Nexa AppLauncher] Launching native app: ${target.name} via ${launchUri}`);
        
        // This triggers Android system's package resolver
        window.location.href = launchUri;
        
        return {
          success: true,
          nativeAttempt: true,
          targetName: target.name,
          message: `Triggered native Android launch for ${target.name}, Bhavik.`
        };
      } catch (e: any) {
        console.error(`[Nexa AppLauncher] Failed to launch ${target.name} natively:`, e);
        return {
          success: false,
          nativeAttempt: true,
          targetName: target.name,
          message: `I tried to launch the native ${target.name} app, but it seems it isn't installed on your Android device.`
        };
      }
    } else {
      // Desktop / Mobile Web Fallback
      if (target.webFallback) {
        try {
          window.open(target.webFallback, '_blank');
        } catch (err) {
          console.error("[AppLauncher] Failed to open web fallback:", err);
        }
        return {
          success: true,
          nativeAttempt: false,
          targetName: target.name,
          message: `Opening ${target.name} for you, Bhavik.`
        };
      } else {
        return {
          success: false,
          nativeAttempt: false,
          targetName: target.name,
          message: `The native ${target.name} app can only be launched when running inside my Android APK package.`
        };
      }
    }
  }

  /**
   * Returns list of all launchable native apps
   */
  public static getLaunchableApps(): string[] {
    return Object.keys(this.appMappings).map(key => this.appMappings[key].name);
  }
}
