import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ClientEvent, MatrixEvent } from 'matrix-js-sdk';
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
  Chip,
} from 'folds';
import { useTranslation } from 'react-i18next';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { stopPropagation } from '../utils/keyboard';
import { getAccountData } from '../utils/room';
import { AccountDataEvent, FirstRunSetupContent } from '../../types/matrix/accountData';
import { makeFirstRunSetupContent, isFirstRunSetupComplete } from '../state/firstRunSetup';
import {
  shellLayoutAtom,
  getSidebarPosition,
  getNavPosition,
  makeShellLayoutContent,
  ShellDockPosition,
} from '../state/shellLayout';
import { firstRunSetupBlockingAtom } from '../state/firstRunSetupGate';
import {
  DEFAULT_MINI_TILE_STRIP_POSITION,
  MiniTileStripPosition,
  getMiniTileStripPosition,
  setMiniTileStripPosition,
} from '../features/call/miniTileStripSettings';

const DOCK_POSITIONS: ShellDockPosition[] = ['left', 'right', 'top', 'bottom'];
const MINI_TILE_POSITIONS: MiniTileStripPosition[] = ['top', 'bottom', 'left', 'right'];

type DockPositionPickerProps = {
  label: string;
  value: ShellDockPosition;
  onChange: (position: ShellDockPosition) => void;
  testIdPrefix: string;
};

function DockPositionPicker({ label, value, onChange, testIdPrefix }: DockPositionPickerProps) {
  const { t } = useTranslation();

  return (
    <Box direction="Column" gap="100">
      <Text size="L400" priority="300">
        {label}
      </Text>
      <Box gap="100" wrap="Wrap">
        {DOCK_POSITIONS.map((position) => (
          <Chip
            key={position}
            data-testid={`${testIdPrefix}_${position}`}
            variant={value === position ? 'Primary' : 'SurfaceVariant'}
            aria-pressed={value === position}
            outlined={value === position}
            radii="300"
            onClick={() => onChange(position)}
            type="button"
          >
            <Text truncate size="T300">
              {t(`settings.general.dock_position_names.${position}`)}
            </Text>
          </Chip>
        ))}
      </Box>
    </Box>
  );
}

export function FirstRunSetup() {
  const { t } = useTranslation();
  const mx = useMatrixClient();

  const shellLayout = useAtomValue(shellLayoutAtom);
  const setShellLayout = useSetAtom(shellLayoutAtom);
  const setFirstRunSetupBlocking = useSetAtom(firstRunSetupBlockingAtom);

  const [checked, setChecked] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [sidebarPosition, setSidebarPosition] = useState<ShellDockPosition>(() =>
    getSidebarPosition(shellLayout)
  );
  const [navPosition, setNavPosition] = useState<ShellDockPosition>(() =>
    getNavPosition(shellLayout)
  );
  const [miniTilePosition, setMiniTilePosition] = useState<MiniTileStripPosition>(
    DEFAULT_MINI_TILE_STRIP_POSITION
  );

  // SelfMatrix fix (敵対的レビュー FIX-3): mount 時の一発読みだけだと、他
  // デバイスで完了済みにしたフラグが増分 sync で遅れて届いた場合、その到着を
  // 拾えず二重表示されうる。shellLayout.ts の useBindShellLayoutAtom (B3
  // fix) と同じパターンで ClientEvent.AccountData を購読し、フラグ到着で
  // 即座に非表示にする。
  useEffect(() => {
    const event = getAccountData(mx, AccountDataEvent.FirstRunSetup);
    const alreadyCompleted = isFirstRunSetupComplete(event?.getContent<FirstRunSetupContent>());
    setCompleted(alreadyCompleted);
    setChecked(true);
    setMiniTilePosition(getMiniTileStripPosition());

    const handleAccountData = (accountDataEvent: MatrixEvent) => {
      if (accountDataEvent.getType() !== AccountDataEvent.FirstRunSetup) return;
      const nowCompleted = isFirstRunSetupComplete(
        accountDataEvent.getContent<FirstRunSetupContent>()
      );
      if (nowCompleted) {
        setCompleted(true);
      }
    };

    mx.on(ClientEvent.AccountData, handleAccountData);
    return () => {
      mx.removeListener(ClientEvent.AccountData, handleAccountData);
    };
  }, [mx]);

  const shouldShow = checked && !completed;

  // SelfMatrix: keep VerificationReminder blocked until we know for sure that
  // FirstRunSetup does not need to show (or until it has finished), so the
  // two dialogs never overlap ("モーダル連発禁止", UI 合意 v1.4 ④).
  useEffect(() => {
    setFirstRunSetupBlocking(!checked || shouldShow);
  }, [checked, shouldShow, setFirstRunSetupBlocking]);

  // SelfMatrix fix (敵対的レビュー FIX-4): setAccountData を await し、失敗は
  // console.error に留めて unhandled rejection を出さない。送信が失敗しても
  // このセッション中はダイアログが completed 扱いになる (再表示させない) —
  // ユーザーが既に Apply/Skip を選んだ意思決定はこのセッションでは尊重し、
  // 再送はアプリの再起動後の通常の起動時読み込みに委ねる。
  const markCompleted = useCallback(async () => {
    const content = makeFirstRunSetupContent();
    setCompleted(true);
    try {
      await mx.setAccountData(AccountDataEvent.FirstRunSetup, content);
    } catch (e) {
      console.error('Failed to save first-run setup completion:', e);
    }
  }, [mx]);

  const handleApply = useCallback(() => {
    const content = makeShellLayoutContent(shellLayout, {
      sidebarPosition,
      navPosition,
    });
    setShellLayout({ type: 'UPDATE', content });
    mx.setAccountData(AccountDataEvent.ShellLayout, content);
    setMiniTileStripPosition(miniTilePosition);
    markCompleted();
  }, [
    mx,
    shellLayout,
    sidebarPosition,
    navPosition,
    miniTilePosition,
    setShellLayout,
    markCompleted,
  ]);

  const handleSkip = useCallback(() => {
    markCompleted();
  }, [markCompleted]);

  const dockLabels = useMemo(
    () => ({
      server: t('first_run_setup.server_list_position.title'),
      channel: t('first_run_setup.channel_list_position.title'),
      miniTile: t('first_run_setup.mini_tile_position.title'),
    }),
    [t]
  );

  if (!shouldShow) return null;

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: false,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface" data-testid="first_run_setup">
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">{t('first_run_setup.title')}</Text>
              </Box>
            </Header>
            <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
              <Text priority="400">{t('first_run_setup.description')}</Text>
              <Text priority="300" size="T200">
                {t('first_run_setup.change_later_hint')}
              </Text>

              <DockPositionPicker
                label={dockLabels.server}
                value={sidebarPosition}
                onChange={setSidebarPosition}
                testIdPrefix="fr_server"
              />
              <DockPositionPicker
                label={dockLabels.channel}
                value={navPosition}
                onChange={setNavPosition}
                testIdPrefix="fr_channel"
              />

              <Box direction="Column" gap="100">
                <Text size="L400" priority="300">
                  {dockLabels.miniTile}
                </Text>
                <Box gap="100" wrap="Wrap">
                  {MINI_TILE_POSITIONS.map((position) => (
                    <Chip
                      key={position}
                      data-testid={`fr_minitile_${position}`}
                      variant={miniTilePosition === position ? 'Primary' : 'SurfaceVariant'}
                      aria-pressed={miniTilePosition === position}
                      outlined={miniTilePosition === position}
                      radii="300"
                      onClick={() => setMiniTilePosition(position)}
                      type="button"
                    >
                      <Text truncate size="T300">
                        {t(`settings.general.dock_position_names.${position}`)}
                      </Text>
                    </Chip>
                  ))}
                </Box>
              </Box>

              <Box direction="Column" gap="200">
                <Button data-testid="fr_apply" variant="Primary" onClick={handleApply}>
                  <Text size="B400">{t('first_run_setup.apply_button')}</Text>
                </Button>
                <Button data-testid="fr_skip" variant="Secondary" fill="Soft" onClick={handleSkip}>
                  <Text size="B400">{t('first_run_setup.skip_button')}</Text>
                </Button>
              </Box>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
