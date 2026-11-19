import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';

export class PermissionService {
  /**
   * Checks if camera permission is granted.
   */
  public static async checkCameraPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await Camera.checkPermissions();
        return status.camera === 'granted';
      } catch (e) {
        console.error("[Nexa Permissions] Native camera check failed:", e);
        return false;
      }
    } else {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as any });
        return permissionStatus.state === 'granted';
      } catch {
        // Fallback for browsers that do not support camera querying in permissions API
        return false;
      }
    }
  }

  /**
   * Requests camera permission from the user.
   */
  public static async requestCameraPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await Camera.requestPermissions({ permissions: ['camera'] });
        return status.camera === 'granted';
      } catch (e) {
        console.error("[Nexa Permissions] Native camera request failed:", e);
        return false;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (e) {
        console.error("[Nexa Permissions] Web camera request failed:", e);
        return false;
      }
    }
  }

  /**
   * Requests permission to show notifications.
   */
  public static async requestNotificationPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await LocalNotifications.requestPermissions();
        return status.display === 'granted';
      } catch (e) {
        console.error("[Nexa Permissions] Native notification request failed:", e);
        return false;
      }
    } else {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return false;
    }
  }
}
