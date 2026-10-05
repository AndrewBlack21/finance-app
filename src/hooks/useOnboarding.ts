import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const VERSION = "v1";
const PENDING_PREFIX = "@secontrola_onboarding_pending:";
const COMPLETED_PREFIX = "@secontrola_onboarding_completed:";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const pendingKey = (email: string) =>
  `${PENDING_PREFIX}${normalizeEmail(email)}`;

const completedKey = (userId: string) =>
  `${COMPLETED_PREFIX}${VERSION}:${userId}`;

export async function markOnboardingPending(email: string) {
  if (!email) return;

  await AsyncStorage.setItem(pendingKey(email), "1");
}

export function useOnboarding(params: {
  userId?: string | null;
  email?: string | null;
}) {
  const { userId, email } = params;
  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    const checkState = async () => {
      if (!userId) {
        if (active) {
          setIsVisible(false);
          setIsReady(true);
        }
        return;
      }

      try {
        const [completed, pending] = await Promise.all([
          AsyncStorage.getItem(completedKey(userId)),
          email ? AsyncStorage.getItem(pendingKey(email)) : null,
        ]);

        if (!active) return;

        // Só abre automaticamente quando a própria aplicação registrou
        // que este usuário acabou de criar a conta.
        setIsVisible(completed !== "1" && pending === "1");
      } catch {
        if (active) setIsVisible(false);
      } finally {
        if (active) setIsReady(true);
      }
    };

    void checkState();

    return () => {
      active = false;
    };
  }, [userId, email]);

  const open = useCallback(() => {
    setIsVisible(true);
  }, []);

  const close = useCallback(() => {
    setIsVisible(false);
  }, []);

  const complete = useCallback(async () => {
    if (userId) {
      await AsyncStorage.setItem(completedKey(userId), "1");
    }

    if (email) {
      await AsyncStorage.removeItem(pendingKey(email));
    }

    setIsVisible(false);
  }, [userId, email]);

  const skip = useCallback(async () => {
    await complete();
  }, [complete]);

  return {
    isVisible,
    isReady,
    open,
    close,
    complete,
    skip,
  };
}
