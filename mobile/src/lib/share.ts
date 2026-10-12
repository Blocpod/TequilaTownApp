import { Platform, Share } from 'react-native';

import { toast } from '@/components/ui/toast';

/** Native share sheet. Resolves true when the guest actually shared. */
export async function shareText(message: string, url?: string, title = 'Tequila Town'): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) {
        await nav.share({ title, text: message, url });
        return true;
      }
      await nav?.clipboard?.writeText(url ? `${message} ${url}` : message);
      toast.info('Copied to clipboard');
      return true;
    }
    const result = await Share.share(Platform.OS === 'ios' && url ? { message, url, title } : { message: url ? `${message}\n${url}` : message, title });
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}
