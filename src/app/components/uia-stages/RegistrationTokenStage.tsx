import React, { useEffect, useCallback, FormEventHandler } from 'react';
import { Dialog, Text, Box, Button, config, Input } from 'folds';
import { AuthType } from 'matrix-js-sdk';
import { useTranslation } from 'react-i18next';
import { StageComponentProps } from './types';
import { ErrorCode } from '../../cs-errorcode';

/**
 * SelfMatrix: M3 fix — map the raw UIA errcode to a user-facing i18n key
 * instead of showing the server's bare errcode as the dialog title. Synapse's
 * RegistrationTokenAuthChecker returns M_UNAUTHORIZED for any invalid,
 * exhausted, or expired token (it does not distinguish between those cases
 * in the errcode), so we cannot offer a more specific message than
 * "invalid_or_unknown" without parsing free-text `error`. Rate limiting
 * during retries surfaces as M_LIMIT_EXCEEDED. Anything else falls back to a
 * generic message rather than leaking the raw errcode to the user.
 */
export const getRegistrationTokenErrorKey = (
  errorCode?: string
): 'invalid_or_unknown' | 'rate_limited' | 'unknown' => {
  if (errorCode === ErrorCode.M_UNAUTHORIZED || errorCode === ErrorCode.M_FORBIDDEN) {
    return 'invalid_or_unknown';
  }
  if (errorCode === ErrorCode.M_LIMIT_EXCEEDED) {
    return 'rate_limited';
  }
  return 'unknown';
};

function RegistrationTokenErrorDialog({
  title,
  message,
  defaultToken,
  onRetry,
  onCancel,
}: {
  title: string;
  message: string;
  defaultToken?: string;
  onRetry: (token: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const handleFormSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const { retryTokenInput } = evt.target as HTMLFormElement & {
      retryTokenInput: HTMLInputElement;
    };
    const tokenValue = retryTokenInput.value;
    onRetry(tokenValue);
  };

  return (
    <Dialog>
      <Box
        as="form"
        onSubmit={handleFormSubmit}
        style={{ padding: config.space.S400 }}
        direction="Column"
        gap="400"
      >
        <Box direction="Column" gap="100">
          <Text size="H4">{title}</Text>
          <Text>{message}</Text>
          <Text as="label" size="L400" style={{ paddingTop: config.space.S400 }}>
            {t('auth.register.registration_token_label')}
          </Text>
          <Input
            name="retryTokenInput"
            variant="Background"
            size="500"
            outlined
            defaultValue={defaultToken}
            required
          />
        </Box>
        <Button variant="Critical" type="submit">
          <Text as="span" size="B400">
            {t('auth.register.token_stage.retry_button')}
          </Text>
        </Button>
        <Button variant="Critical" fill="None" outlined type="button" onClick={onCancel}>
          <Text as="span" size="B400">
            {t('auth.register.token_stage.cancel_button')}
          </Text>
        </Button>
      </Box>
    </Dialog>
  );
}

export function RegistrationTokenStageDialog({
  token,
  stageData,
  submitAuthDict,
  onCancel,
}: StageComponentProps & {
  token?: string;
}) {
  const { t } = useTranslation();
  const { errorCode, session } = stageData;

  const handleSubmit = useCallback(
    (tokenValue: string) => {
      submitAuthDict({
        type: AuthType.RegistrationToken,
        token: tokenValue,
        session,
      });
    },
    [session, submitAuthDict]
  );

  useEffect(() => {
    if (token && !errorCode) handleSubmit(token);
  }, [handleSubmit, token, errorCode]);

  if (errorCode) {
    const errorKey = getRegistrationTokenErrorKey(errorCode);
    return (
      <RegistrationTokenErrorDialog
        defaultToken={token}
        title={t('auth.register.token_stage.retry_title')}
        message={t(`auth.register.token_stage.errors.${errorKey}`)}
        onRetry={handleSubmit}
        onCancel={onCancel}
      />
    );
  }

  if (!token) {
    return (
      <RegistrationTokenErrorDialog
        defaultToken={token}
        title={t('auth.register.token_stage.prompt_title')}
        message={t('auth.register.token_stage.prompt_message')}
        onRetry={handleSubmit}
        onCancel={onCancel}
      />
    );
  }

  return null;
}
