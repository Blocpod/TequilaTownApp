import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, ImagePlus, Phone, User } from 'lucide-react-native';
import { useState } from 'react';
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { PaperBackground, TopBar } from '@/components/ui/screen';
import { LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { prepareJpeg } from '@/lib/image';
import { useMe, useSetMe } from '@/lib/queries';
import { colors, gutter } from '@/theme/tokens';

export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const { data } = useMe();
  const setMe = useSetMe();
  const [name, setName] = useState(data?.user.name ?? '');
  const [phone, setPhone] = useState(data?.user.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!data) return <LoadingState />;
  const user = data.user;

  const upload = async (source: 'camera' | 'library') => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 };
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return toast.error('Camera access needed', 'Allow camera access in Settings.');
    }
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync({ ...opts, cameraType: ImagePicker.CameraType.front }) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]?.uri) return;
    setUploading(true);
    try {
      const { base64 } = await prepareJpeg(res.assets[0].uri, 512, 0.85);
      setMe(await api.uploadAvatar({ image: base64 }));
      toast.success('Looking sharp');
    } catch (e) {
      toast.error('Upload failed', errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const choosePhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 }, (i) => {
        if (i === 0) void upload('camera');
        if (i === 1) void upload('library');
      });
    } else if (Platform.OS === 'android') {
      Alert.alert('Profile photo', undefined, [
        { text: 'Take photo', onPress: () => void upload('camera') },
        { text: 'Choose from library', onPress: () => void upload('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      void upload('library');
    }
  };

  const save = async () => {
    if (!name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      setMe(await api.updateMe({ name: name.trim(), phone: phone.trim() || null }));
      toast.success('Profile saved');
      router.back();
    } catch (e) {
      toast.error('Could not save', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBackground />
      <TopBar leading="close" title="Edit profile" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 80, paddingHorizontal: gutter, paddingBottom: insets.bottom + 40, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 10 }}>
            <PressableScale onPress={choosePhoto} accessibilityLabel="Change profile photo" disabled={uploading}>
              <Avatar name={user.name} url={user.avatarUrl} size={120} />
              <View style={styles.cam}>{uploading ? <Text style={{ color: colors.card }}>…</Text> : <Camera size={18} color={colors.card} />}</View>
            </PressableScale>
            <Button label={uploading ? 'Uploading…' : 'Change photo'} icon={ImagePlus} variant="ghost" size="sm" onPress={choosePhoto} disabled={uploading} />
          </View>
          <TextField label="Name" icon={User} value={name} onChangeText={setName} autoComplete="name" maxLength={60} />
          <TextField label="Phone (optional)" icon={Phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" hint="Only used if the Mercado needs to reach you about a reservation." />
          {user.email ? <TextField label="Email" value={user.email} editable={false} hint={user.providers.includes('apple') ? 'Managed by Sign in with Apple.' : 'Your sign-in email.'} /> : null}
          <Button label="Save" onPress={save} loading={saving} full />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  cam: { position: 'absolute', right: 0, bottom: 4, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.terracotta, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
