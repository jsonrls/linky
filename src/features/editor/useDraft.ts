"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, RequestError, unresolvedRequest } from "@/lib/client-api";
import type { Profile, EditableProfile } from "@/features/profiles/model";
export const editable = (profile: Profile): EditableProfile => ({
  label: profile.label,
  handle: profile.handle,
  document: profile.document,
});
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
type Failure = { code: string; message: string } | null;
type SaveRequest = {
  operationId: string;
  expectedRevision: number;
  body: EditableProfile;
};
export function useDraft(initial: Profile) {
  const [profile, setProfile] = useState(initial);
  const [value, setValue] = useState(() => editable(initial));
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  const saved = useRef(initial);
  const current = useRef(value);
  const pending = useRef<SaveRequest | null>(null);
  const inFlight = useRef<Promise<Profile | null> | null>(null);
  const failureRef = useRef<Failure>(null);
  const fail = useCallback((error: Failure) => {
    failureRef.current = error;
    setFailure(error);
  }, []);
  const change = useCallback(
    (
      update: EditableProfile | ((current: EditableProfile) => EditableProfile),
    ) => {
      const next =
        typeof update === "function" ? update(current.current) : update;
      current.current = next;
      setValue(next);
      if (
        failureRef.current &&
        !["revision_conflict", "unauthenticated", "uncertain"].includes(
          failureRef.current.code,
        )
      )
        fail(null);
    },
    [fail],
  );
  const save = useCallback(
    async (afterAuthentication = false): Promise<Profile | null> => {
      if (inFlight.current) return inFlight.current;
      if (
        failureRef.current?.code === "revision_conflict" ||
        (failureRef.current?.code === "unauthenticated" && !afterAuthentication)
      )
        return null;
      if (!pending.current && same(current.current, editable(saved.current)))
        return saved.current;
      pending.current ??= {
        operationId: crypto.randomUUID(),
        expectedRevision: saved.current.revision,
        body: structuredClone(current.current),
      };
      const request = pending.current;
      setSaving(true);
      const work = (async () => {
        try {
          const result = await api<Profile>(
            `/api/profiles/${saved.current.id}/save`,
            request,
          );
          saved.current = result;
          setProfile(result);
          pending.current = null;
          fail(null);
          if (same(current.current, request.body)) {
            current.current = editable(result);
            setValue(current.current);
          }
          return result;
        } catch (error) {
          const unresolved = unresolvedRequest(error);
          const code =
            error instanceof RequestError && error.status === 401
              ? "unauthenticated"
              : unresolved
                ? "uncertain"
                : (error as RequestError).code;
          if (!unresolved) pending.current = null;
          fail({ code, message: (error as Error).message });
          return null;
        } finally {
          setSaving(false);
          inFlight.current = null;
        }
      })();
      inFlight.current = work;
      return work;
    },
    [fail],
  );
  const dirty = !same(value, editable(profile));
  useEffect(() => {
    if (!dirty || saving || failure) return;
    const timer = setTimeout(() => void save(), 750);
    return () => clearTimeout(timer);
  }, [dirty, value, saving, failure, save]);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!same(current.current, editable(saved.current)) || pending.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const flush = useCallback(async () => {
    if (!(await save())) return null;
    if (!same(current.current, editable(saved.current))) return save();
    return saved.current;
  }, [save]);
  function reload(latest: Profile) {
    saved.current = latest;
    setProfile(latest);
    pending.current = null;
    current.current = editable(latest);
    setValue(current.current);
    fail(null);
  }
  function publication(latest: Profile) {
    const next = {
      ...saved.current,
      publicationId: latest.publicationId,
      publishedRevision: latest.publishedRevision,
      firstPublishedAt: latest.firstPublishedAt,
      updatedAt: latest.updatedAt,
    };
    saved.current = next;
    setProfile(next);
    if (latest.revision !== next.revision)
      fail({
        code: "revision_conflict",
        message:
          "Another tab saved a newer draft. Copy your unsaved work or reload the latest draft.",
      });
  }
  function resume(latest: Profile) {
    if (latest.revision !== saved.current.revision) {
      fail({
        code: "revision_conflict",
        message:
          "A newer draft was saved while you were away. Copy your work or reload the latest draft.",
      });
      return;
    }
    fail(null);
  }
  return {
    profile,
    value,
    change,
    saving,
    failure,
    dirty,
    save,
    flush,
    reload,
    publication,
    resume,
    fail,
    pending,
  };
}
