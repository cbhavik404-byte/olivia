import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AppLauncher } from './AppLauncher';
import { FlashlightService } from './FlashlightService';
import { PermissionService } from './PermissionService';

export class DeviceManager {
  /**
   * Check if running on Android/Native platform.
   */
  public static isAndroidNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Open standard Android apps or fallback
   */
  public static async launchApp(appName: string) {
    return await AppLauncher.launchApp(appName);
  }

  /**
   * Set physical flashlight on/off
   */
  public static async toggleFlashlight(enabled: boolean): Promise<boolean> {
    return await FlashlightService.setFlashlight(enabled);
  }

  /**
   * Write text to device clipboard
   */
  public static async copyToClipboard(text: string): Promise<boolean> {
    if (this.isAndroidNative()) {
      try {
        await Clipboard.write({ string: text });
        return true;
      } catch (e) {
        console.error("[Nexa Device] Native clipboard write failed:", e);
        return false;
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        console.error("[Nexa Device] Web clipboard write failed:", e);
        return false;
      }
    }
  }

  /**
   * Read text from device clipboard
   */
  public static async readFromClipboard(): Promise<string | null> {
    if (this.isAndroidNative()) {
      try {
        const { value } = await Clipboard.read();
        return value || null;
      } catch (e) {
        console.error("[Nexa Device] Native clipboard read failed:", e);
        return null;
      }
    } else {
      try {
        return await navigator.clipboard.readText();
      } catch (e) {
        console.error("[Nexa Device] Web clipboard read failed:", e);
        return null;
      }
    }
  }

  /**
   * Open OS Share sheet
   */
  public static async share(title: string, text: string, url?: string): Promise<boolean> {
    if (this.isAndroidNative()) {
      try {
        await Share.share({ title, text, url });
        return true;
      } catch (e) {
        console.error("[Nexa Device] Native share failed:", e);
        return false;
      }
    } else {
      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
          return true;
        } catch (e) {
          console.error("[Nexa Device] Web share failed:", e);
          return false;
        }
      } else {
        console.warn("[Nexa Device] Web share not supported in this browser.");
        return false;
      }
    }
  }

  /**
   * Push an instant local notification
   */
  public static async triggerNotification(title: string, body: string) {
    const hasPermission = await PermissionService.requestNotificationPermission();
    if (!hasPermission) {
      console.warn("[Nexa Device] Notification permission denied.");
      return false;
    }

    if (this.isAndroidNative()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Math.floor(Math.random() * 100000),
              smallIcon: 'res://ic_stat_name', // will map to default notification icon
              actionTypeId: 'OPEN_APP'
            }
          ]
        });
        return true;
      } catch (e) {
        console.error("[Nexa Device] Native notification failed:", e);
        return false;
      }
    } else {
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
          return true;
        }
        return false;
      } catch (e) {
        console.error("[Nexa Device] Web notification failed:", e);
        return false;
      }
    }
  }
}
