"use client";

import { useState } from "react";
import { BriefcaseIcon, CakeIcon, MailIcon, MapPinIcon, PencilIcon, PhoneIcon } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/dialogs/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatLong, fromKey, MONTHS } from "@/lib/dates";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToday } from "@/hooks/use-today";
import { useAppStore } from "@/stores/app-store";
import { Card, CardHeader, PageHeader, PageRoot } from "@/components/pages/shared/page-chrome";

/** Phones: 40px fields with 16px text, so iOS doesn't zoom in on focus. */
const TOUCH_FIELD = "max-md:h-10 max-md:text-[16px]";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BIO_MAX = 280;

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function tenure(start: string, today: string) {
  if (!start || start > today) return null;
  const a = fromKey(start);
  const b = fromKey(today);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y && !m) return "Less than a month";
  return [y ? `${y} ${y === 1 ? "year" : "years"}` : "", m ? `${m} ${m === 1 ? "month" : "months"}` : ""]
    .filter(Boolean)
    .join(" ");
}

function validate(p: Profile): Partial<Record<keyof Profile, string>> {
  const errors: Partial<Record<keyof Profile, string>> = {};
  if (!p.name.trim()) errors.name = "Your name is required.";
  if (!p.email.trim()) errors.email = "An email address is required.";
  else if (!EMAIL_RE.test(p.email.trim())) errors.email = "Enter a valid email address.";
  if (!p.initials.trim()) errors.initials = "Add 1–3 initials.";
  if (p.bio.length > BIO_MAX) errors.bio = `Keep it under ${BIO_MAX} characters.`;
  if (p.startDate && p.birthday && p.birthday >= p.startDate) {
    errors.birthday = "Birthday must be before your start date.";
    errors.startDate = "Your start date must be after your birthday.";
  }
  return errors;
}

type SectionId = "basic" | "work" | "personal" | "about";

/** What each section holds. The page shows them read-only; each opens its own edit dialog. */
const SECTIONS: Record<SectionId, { title: string; description: string; keys: (keyof Profile)[] }> = {
  basic: { title: "Basic information", description: "How you appear across the workspace", keys: ["name", "initials", "email", "phone"] },
  work: { title: "Work", description: "Your role and reporting line", keys: ["jobTitle", "department", "manager", "location", "startDate"] },
  personal: { title: "Personal", description: "Only visible to People Ops", keys: ["birthday", "emergencyContact", "address"] },
  about: { title: "About", description: "A short intro for your teammates", keys: ["bio"] },
};

const blank = <span className="text-placeholder">Not set</span>;
const text = (v: string) => (v.trim() ? v : blank);
const date = (v: string) => (v ? formatLong(v) : blank);

export function PersonalDetailsPage() {
  const today = useToday();
  const profile = useAppStore((s) => s.profile);
  const [editing, setEditing] = useState<SectionId | null>(null);

  const t = tenure(profile.startDate, today);
  const birthday = profile.birthday ? fromKey(profile.birthday) : null;
  const section = (id: SectionId, rows: [string, React.ReactNode][]) => (
    <Card>
      <CardHeader
        title={SECTIONS[id].title}
        description={SECTIONS[id].description}
        actions={
          <Button variant="ghost" size="sm" className="h-9 px-3" aria-label={`Edit ${SECTIONS[id].title.toLowerCase()}`} onClick={() => setEditing(id)}>
            <PencilIcon /> Edit
          </Button>
        }
      />
      <dl className="divide-y divide-subtle">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-h-11 items-start gap-4 px-4 py-2.5 max-sm:flex-col max-sm:gap-1">
            <dt className="t-14 w-40 shrink-0 text-fg-2">{label}</dt>
            <dd className="t-14 min-w-0 flex-1 text-pretty break-words text-fg">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );

  return (
    <PageRoot>
      <PageHeader title="Your profile" description="Shared with your manager and People Ops" />
      <div className="mx-auto grid w-full max-w-[1040px] grid-cols-1 items-start gap-3 p-4 md:gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Summary */}
        <Card className="lg:sticky lg:top-[84px]">
          {/* Below lg the summary is a compact horizontal header; the sidebar card from lg. */}
          <div className="flex items-center gap-3.5 p-4 lg:flex-col lg:gap-3 lg:px-4 lg:pt-6 lg:pb-5 lg:text-center">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-[16px] bg-brand-tint lg:size-16 lg:rounded-[18px]">
              <span className="font-inter text-[20px] leading-none font-semibold tracking-[-0.3px] text-brand lg:text-[22px] lg:tracking-[-0.33px]">
                {profile.initials.toUpperCase() || "?"}
              </span>
            </span>
            <div className="grid min-w-0 gap-2">
              <p className="t-16 text-fg">{profile.name || "Your name"}</p>
              <p className="t-14 text-fg-2">{[profile.jobTitle, profile.department].filter(Boolean).join(" · ") || "Add a job title"}</p>
            </div>
          </div>
          <ul className="grid gap-x-4 gap-y-3 border-t border-subtle px-4 py-4 sm:grid-cols-2 lg:grid-cols-1" data-catalog>
            <SummaryRow icon={<MailIcon />}>{profile.email || "—"}</SummaryRow>
            <SummaryRow icon={<PhoneIcon />}>{profile.phone || "—"}</SummaryRow>
            <SummaryRow icon={<MapPinIcon />}>{profile.location || "—"}</SummaryRow>
            <SummaryRow icon={<BriefcaseIcon />}>
              {profile.startDate ? `Joined ${MONTHS[fromKey(profile.startDate).getMonth()].slice(0, 3)} ${profile.startDate.slice(0, 4)}` : "—"}
              {t ? <span className="text-placeholder"> · {t}</span> : null}
            </SummaryRow>
            <SummaryRow icon={<CakeIcon />} className="sm:col-span-2 lg:col-span-1">
              {birthday ? `${MONTHS[birthday.getMonth()]} ${birthday.getDate()}` : "—"}
            </SummaryRow>
          </ul>
        </Card>

        <div className="grid min-w-0 gap-4">
          {section("basic", [
            ["Full name", text(profile.name)],
            ["Initials", text(profile.initials)],
            ["Email", text(profile.email)],
            ["Phone", text(profile.phone)],
          ])}
          {section("work", [
            ["Job title", text(profile.jobTitle)],
            ["Department", text(profile.department)],
            ["Manager", text(profile.manager)],
            ["Location", text(profile.location)],
            ["Start date", profile.startDate ? `${formatLong(profile.startDate)}${t ? ` · ${t}` : ""}` : blank],
          ])}
          {section("personal", [
            ["Birthday", date(profile.birthday)],
            ["Emergency contact", text(profile.emergencyContact)],
            ["Home address", text(profile.address)],
          ])}
          {section("about", [["Bio", profile.bio.trim() ? <span className="whitespace-pre-wrap">{profile.bio}</span> : blank]])}
        </div>
      </div>

      <SectionDialog section={editing} profile={profile} today={today} onClose={() => setEditing(null)} />
    </PageRoot>
  );
}

/**
 * Edits one section of the profile. Nothing on the page changes until Save, so a stray
 * keystroke can't alter the details HR relies on.
 */
function SectionDialog({ section, profile, today, onClose }: { section: SectionId | null; profile: Profile; today: string; onClose: () => void }) {
  return (
    <Dialog open={!!section} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-5 sm:max-w-[520px]">
        {/* Remounts per section, so each opens on the saved values */}
        {section ? <SectionForm key={section} section={section} profile={profile} today={today} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SectionForm({ section, profile, today, onClose }: { section: SectionId; profile: Profile; today: string; onClose: () => void }) {
  const updateProfile = useAppStore((s) => s.updateProfile);
  const { title, description, keys } = SECTIONS[section];
  const [draft, setDraft] = useState<Profile>(profile);
  const [showErrors, setShowErrors] = useState(false);
  const [touched, setTouched] = useState<Set<keyof Profile>>(new Set());

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setTouched((s) => new Set(s).add(key));
  };
  const changed = keys.filter((k) => String(draft[k]).trim() !== String(profile[k]));
  const errors = validate(draft);
  const hasErrors = keys.some((k) => errors[k]);
  // Errors show once a field has been edited, or for every field after a failed save.
  const err = (k: keyof Profile) => ((showErrors || touched.has(k)) && errors[k]) || null;
  const input = (k: keyof Profile, { className, ...props }: React.ComponentProps<typeof Input> = {}) => (
    <Input
      id={`pd-${k}`}
      value={draft[k]}
      onChange={(e) => set(k, e.target.value)}
      aria-invalid={err(k) ? true : undefined}
      className={cn(TOUCH_FIELD, className)}
      {...props}
    />
  );
  const t = tenure(draft.startDate, today);
  const suggested = initialsFrom(draft.name);

  return (
    <form
      className="contents"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (hasErrors) return setShowErrors(true);
        if (changed.length) {
          const patch: Partial<Profile> = {};
          for (const k of changed) (patch as Record<string, string>)[k] = String(draft[k]).trim();
          if (patch.initials) patch.initials = patch.initials.toUpperCase();
          updateProfile(patch);
          toast.success("Profile saved", { description: `${title} · ${changed.length} ${changed.length === 1 ? "field" : "fields"} updated` });
        }
        onClose();
      }}
    >
      <DialogHeader className="gap-1.5">
        <DialogTitle className="t-16">Edit {title.toLowerCase()}</DialogTitle>
        <DialogDescription className="t-14">{description}</DialogDescription>
      </DialogHeader>

      {section === "basic" ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_88px] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_120px] sm:gap-4">
            <Field label="Full name" htmlFor="pd-name" error={err("name")}>
              {input("name", { autoComplete: "name", required: true })}
            </Field>
            <Field label="Initials" htmlFor="pd-initials" error={err("initials")}>
              {input("initials", {
                maxLength: 3,
                className: "uppercase",
                onChange: (e) => set("initials", e.target.value.toUpperCase().replace(/[^A-Z]/g, "")),
              })}
            </Field>
          </div>
          {suggested && suggested !== draft.initials ? (
            <button
              type="button"
              onClick={() => set("initials", suggested)}
              className="t-12 -mt-2 inline-flex min-h-[36px] w-fit items-center text-brand outline-none hover-fine:text-brand-strong focus-visible:underline"
            >
              Use “{suggested}” from your name
            </button>
          ) : null}
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="pd-email" error={err("email")}>
              {input("email", { type: "email", autoComplete: "email", required: true })}
            </Field>
            <Field label="Phone" htmlFor="pd-phone">
              {input("phone", { type: "tel", autoComplete: "tel", placeholder: "+226 70 00 00 00" })}
            </Field>
          </div>
        </div>
      ) : section === "work" ? (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <Field label="Job title" htmlFor="pd-jobTitle">
            {input("jobTitle", { autoComplete: "organization-title" })}
          </Field>
          <Field label="Department" htmlFor="pd-department">
            {input("department")}
          </Field>
          <Field label="Manager" htmlFor="pd-manager">
            {input("manager")}
          </Field>
          <Field label="Location" htmlFor="pd-location">
            {input("location", { placeholder: "City, Country" })}
          </Field>
          <Field label="Start date" htmlFor="pd-startDate" hint={t ? `${t} at the company` : undefined} error={err("startDate")} className="sm:col-span-2">
            {input("startDate", { type: "date", max: today })}
          </Field>
        </div>
      ) : section === "personal" ? (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <Field label="Birthday" htmlFor="pd-birthday" error={err("birthday")}>
            {input("birthday", { type: "date", max: today })}
          </Field>
          <Field label="Emergency contact" htmlFor="pd-emergencyContact" hint="Name and phone number">
            {input("emergencyContact", { placeholder: "Name · phone" })}
          </Field>
          <Field label="Home address" htmlFor="pd-address" className="sm:col-span-2">
            {input("address", { autoComplete: "street-address" })}
          </Field>
        </div>
      ) : (
        <Field
          label="Bio"
          htmlFor="pd-bio"
          error={err("bio")}
          hint={
            <span className={cn("tabular-nums", draft.bio.length > BIO_MAX * 0.9 && "text-warning")}>
              {draft.bio.length}/{BIO_MAX}
            </span>
          }
        >
          <Textarea
            id="pd-bio"
            className="max-md:text-[16px]"
            rows={4}
            value={draft.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="What you work on, what you love…"
            aria-invalid={err("bio") ? true : undefined}
          />
        </Field>
      )}

      <DialogFooter className="-mx-5 -mb-5 bg-app px-5 py-3">
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" disabled={!changed.length}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

function SummaryRow({ icon, children, className }: { icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <li className={cn("flex items-center gap-2.5 [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-icon", className)}>
      {icon}
      <span className="t-14 min-w-0 flex-1 truncate text-fg-2">{children}</span>
    </li>
  );
}
