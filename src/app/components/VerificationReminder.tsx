import React, { useCallback, useEffect, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { useAtomValue } from 'jotai';
import {
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Dialog,
  Header,
  config,
  Box,
  Text,
  Button,
} from 'folds';
import { useTranslation } from 'react-i18next';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useCrossSigningActive } from '../hooks/useCrossSigning';
import {
  useDeviceVerificationStatus,
  VerificationStatus,
} from '../hooks/useDeviceVerificationStatus';
import { stopPropagation } from '../utils/keyboard';
import { Modal500 } from './Modal500';
import { Settings, SettingsPages } from '../features/settings';
import { firstRunSetupBlockingAtom } from '../state/firstRunSetupGate';

const SNOOZE_STORAGE_KEY = 'selfmatrix_verification_reminder_snooze';
const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const isSnoozed = (): boolean => {
  try {
    const raw = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    if (Number.isNaN(until)) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
};

const snooze = (): void => {
  try {
    localStorage.setItem(SNOOZE_STORAGE_KEY, String(Date.now() + SNOOZE_DURATION_MS));
  } catch {
    // ignore storage errors
  }
};

export function VerificationReminder() {
  const { t } = useTranslation();
  const mx = useMatrixClient();
  const crypto = mx.getCrypto();

  const crossSigningActive = useCrossSigningActive();
  const verificationStatus = useDeviceVerificationStatus(
    crypto,
    mx.getSafeUserId(),
    mx.getDeviceId() ?? undefined
  );

  const [dismissed, setDismissed] = useState(false);
  const [settings, setSettings] = useState(false);

  // SelfMatrix: serialize against FirstRunSetup (UI 合意 v1.4 ④) — never show
  // both dialogs at once ("モーダル連発禁止").
  const firstRunSetupBlocking = useAtomValue(firstRunSetupBlockingAtom);

  const needsSetup = !crossSigningActive;
  const needsVerification = verificationStatus === VerificationStatus.Unverified;
  const shouldRemind = !firstRunSetupBlocking && (needsSetup || needsVerification);

  useEffect(() => {
    if (!shouldRemind && dismissed) {
      setDismissed(false);
    }
  }, [shouldRemind, dismissed]);

  const handleLater = useCallback(() => {
    snooze();
    setDismissed(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setDismissed(true);
    setSettings(true);
  }, []);

  const closeSettings = useCallback(() => setSettings(false), []);

  if (!crypto) return null;
  if (!shouldRemind || dismissed) {
    return settings ? (
      <Modal500 requestClose={closeSettings}>
        <Settings initialPage={SettingsPages.DevicesPage} requestClose={closeSettings} />
      </Modal500>
    ) : null;
  }
  if (isSnoozed()) return null;

  return (
    <>
      <Overlay open backdrop={<OverlayBackdrop />}>
        <OverlayCenter>
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              clickOutsideDeactivates: true,
              onDeactivate: handleLater,
              escapeDeactivates: stopPropagation,
            }}
          >
            <Dialog variant="Surface">
              <Header
                style={{
                  padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                  borderBottomWidth: config.borderWidth.B300,
                }}
                variant="Surface"
                size="500"
              >
                <Box grow="Yes">
                  <Text size="H4">
                    {needsSetup
                      ? t('verification_reminder.setup_title')
                      : t('verification_reminder.verify_title')}
                  </Text>
                </Box>
              </Header>
              <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
                <Text priority="400">
                  {needsSetup
                    ? t('verification_reminder.setup_description')
                    : t('verification_reminder.verify_description')}
                </Text>
                <Box direction="Column" gap="200">
                  <Button variant="Primary" onClick={handleOpenSettings}>
                    <Text size="B400">{t('verification_reminder.open_settings_button')}</Text>
                  </Button>
                  <Button variant="Secondary" fill="Soft" onClick={handleLater}>
                    <Text size="B400">{t('verification_reminder.later_button')}</Text>
                  </Button>
                </Box>
              </Box>
            </Dialog>
          </FocusTrap>
        </OverlayCenter>
      </Overlay>
      {settings && (
        <Modal500 requestClose={closeSettings}>
          <Settings initialPage={SettingsPages.DevicesPage} requestClose={closeSettings} />
        </Modal500>
      )}
    </>
  );
}
