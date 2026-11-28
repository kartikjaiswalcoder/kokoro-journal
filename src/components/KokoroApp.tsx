import { useEffect, useState } from "react";
import "@/lib/photos";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import Calendar from "@/components/Calendar";
import StreakBanner from "@/components/StreakBanner";
import Notepad from "@/components/Notepad";
import AllEntries from "@/components/AllEntries";
import Reflections from "@/components/Reflections";
import SettingsModal from "@/components/SettingsModal";
import { preloadProfile } from "@/components/ProfileCard";
import EditableHeading from "@/components/EditableHeading";
import LoadingScreen from "@/components/LoadingScreen";
import FutureDayNotice from "@/components/FutureDayNotice";
import MusicPlayer from "@/components/MusicPlayer";
import ReminderPrompt from "@/components/ReminderPrompt";
import DeviceReminderPrompt from "@/components/DeviceReminderPrompt";
import {
  loadReminderSettings,
  dismissReminderPrompt,
  countAppVisit,
  deviceReminderPromptDismissed,
  dismissDeviceReminderPrompt,
  notificationPermission,
  isEmbedded,
} from "@/lib/reminders";
import { shouldOfferReminderPrompt, shouldOfferDevicePrompt } from "@/lib/reminder-schedule";
import { SakuraBlossom } from "@/components/Decor";
import { refreshFromServer, loadLongestStreak } from "@/lib/store";
import { loadHeading } from "@/lib/settings";
import type { View } from "@/types";
import { MONTH_NAMES, todayKey, parseDateKey, isFutureKey } from "@/lib/dates";

export default function KokoroApp() {
  const [view, setView] = useState<View>("journal");
  const [today] = useState(() => new Date());
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string>(todayKey());
  const [openNotepad, setOpenNotepad] = useState(false);
  const [notepadWithSummary, setNotepadWithSummary] = useState(false);
  const [futureKey, setFutureKey] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reminderPrompt, setReminderPrompt] = useState(false);
  // Reminder time of the account, when this device still needs to allow notifications.
  const [devicePrompt, setDevicePrompt] = useState<string | null>(null);
  const [devicePromptUser, setDevicePromptUser] = useState<string | null>(null);

  useEffect(() => {
    refreshFromServer().catch((e) => {
      console.error("Failed to load entries:", e);
    });
    preloadProfile().catch(() => {});
    loadHeading().catch((e) => {
      console.error("Failed to load heading:", e);
    });
    loadLongestStreak().catch((e) => {
      console.error("Failed to load longest streak:", e);
    });
    // After the loading screen, now and then (never on the first visits), invite people
    // without a daily reminder to set one.
    let alive = true;
    const started = Date.now();
    let timer: number | undefined;
    loadReminderSettings()
      .then((s) => {
        if (!s.userId) return;
        const visit = countAppVisit(s.userId);
        if (!alive) return;
        const wait = Math.max(0, 3100 - (Date.now() - started));
        const time = s.time;
        if (time) {
          // Reminders are set on this account: invite this device if it hasn't allowed notifications.
          const offer = shouldOfferDevicePrompt({
            reminderTime: time,
            permission: notificationPermission(),
            embedded: isEmbedded(),
            dismissedOnDevice: deviceReminderPromptDismissed(s.userId),
            visit,
          });
          if (offer) {
            const userId = s.userId;
            timer = window.setTimeout(() => {
              setDevicePromptUser(userId);
              setDevicePrompt(time);
            }, wait);
          }
          return;
        }
        if (s.promptDismissed || !shouldOfferReminderPrompt(visit)) return;
        timer = window.setTimeout(() => setReminderPrompt(true), wait);
      })
      .catch((e) => console.error("Failed to load reminder settings:", e));
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  function closeReminderPrompt(dontShowAgain: boolean, openSettings: boolean) {
    setReminderPrompt(false);
    if (dontShowAgain) void dismissReminderPrompt();
    if (openSettings) setSettingsOpen(true);
  }

  function closeDevicePrompt(dontAskAgain: boolean) {
    setDevicePrompt(null);
    if (dontAskAgain) dismissDeviceReminderPrompt(devicePromptUser);
  }

  function prevMonth() {
    let m = month0 - 1;
    let y = year;
    if (m < 0) {
      m = 11;
      y = y - 1;
    }
    setMonth0(m);
    setYear(y);
  }
  function nextMonth() {
    let m = month0 + 1;
    let y = year;
    if (m > 11) {
      m = 0;
      y = y + 1;
    }
    setMonth0(m);
    setYear(y);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth0(today.getMonth());
    setSelectedKey(todayKey());
  }

  function selectDate(key: string) {
    setSelectedKey(key);
    const d = parseDateKey(key);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
  }

  function openDate(key: string, withSummary = false) {
    setSelectedKey(key);
    const d = parseDateKey(key);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
    if (isFutureKey(key)) {
      setFutureKey(key);
      return;
    }
    setNotepadWithSummary(withSummary);
    setOpenNotepad(true);
  }

  return (
    <div className="relative min-h-screen flex">
      <LoadingScreen />

      <Sidebar view={view} setView={setView} onSettings={() => setSettingsOpen(true)} />

      <main className="relative flex-1 min-w-0 flex flex-col z-10">
        <MobileNav view={view} setView={setView} onSettings={() => setSettingsOpen(true)} />

        <div className="flex-1 px-4 sm:px-8 py-6 sm:py-8 overflow-y-auto scrollbar-soft">
          {/* Journal stays mounted so the music keeps playing on other tabs. */}
          <div className={view === "journal" ? "" : "hidden"}>
            <>
              <header className="mb-6 max-w-5xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] uppercase tracking-widest text-sage-500 font-semibold">
                    {MONTH_NAMES[today.getMonth()]} {today.getFullYear()}
                  </span>
                </div>
                <EditableHeading />
                <p className="text-sm sm:text-base text-charcoal/55 mt-1 max-w-xl text-balance">
                  Every day is a chance to understand yourself a little more.
                </p>
              </header>

              <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] 2xl:grid-cols-[minmax(0,880px)_minmax(0,480px)] 2xl:gap-8">
                <div className="order-2 lg:order-1 min-w-0">
                  <Calendar
                    year={year}
                    month0={month0}
                    selectedKey={selectedKey}
                    onPrev={prevMonth}
                    onNext={nextMonth}
                    onToday={goToday}
                    onSelect={selectDate}
                    onOpen={openDate}
                    keyboardEnabled={view === "journal" && !openNotepad && !futureKey && !settingsOpen && !reminderPrompt && !devicePrompt}
                  />
                </div>
                <div className="order-1 lg:order-2 flex flex-col gap-4 min-w-0">
                  <StreakBanner />
                  <MusicPlayer />
                </div>
              </div>
            </>
          </div>

          {view === "entries" && <AllEntries onOpen={openDate} />}
          {view === "reflections" && <Reflections onOpen={(key) => openDate(key, true)} />}
        </div>
      </main>

      {openNotepad && (
        <Notepad dateKey={selectedKey} startWithSummary={notepadWithSummary} onClose={() => setOpenNotepad(false)} />
      )}
      {futureKey && (
        <FutureDayNotice dateKey={futureKey} onClose={() => setFutureKey(null)} />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {reminderPrompt && !settingsOpen && <ReminderPrompt onDone={closeReminderPrompt} />}
      {devicePrompt && !settingsOpen && <DeviceReminderPrompt time={devicePrompt} onDone={closeDevicePrompt} />}

      {/* Decorative petals */}
      <SakuraBlossom size={90} className="pointer-events-none fixed bottom-24 right-6 text-sakura-100/70 z-0 hidden lg:block" />
    </div>
  );
}
