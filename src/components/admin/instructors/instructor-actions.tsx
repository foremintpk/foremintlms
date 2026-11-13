"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, MailPlus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmAction } from "@/components/common/confirm-action";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { CourseChecklist } from "@/components/admin/course-checklist";
import { ImageField } from "@/components/admin/image-field";
import { useAction } from "@/hooks/use-action";
import {
  approveInstructor,
  assignCourse,
  inviteInstructor,
  resendInvite,
  revokeInvite,
  saveInstructorProfile,
  suspendTeaching,
  unassignCourse,
} from "@/app/admin/instructors/actions";

export function InviteInstructorDialog({ courses }: { courses: { id: string; title: string; status: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"teacher" | "admin">("teacher");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const { run, pending, fieldErrors } = useAction(inviteInstructor, {
    onSuccess: () => {
      setOpen(false);
      setCourseIds([]);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MailPlus /> Invite instructor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>They get an email link that expires in 7 days. Instructors need your approval after they accept.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run({
              email: String(f.get("email") ?? ""),
              fullName: String(f.get("fullName") ?? ""),
              message: String(f.get("message") ?? ""),
              courseIds: role === "teacher" ? courseIds : [],
              role,
            });
          }}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="inv-email">Email</FieldLabel>
                <Input id="inv-email" name="email" type="email" required autoComplete="off" />
                <FieldError>{fieldErrors.email?.[0]}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="inv-name">Name</FieldLabel>
                <Input id="inv-name" name="fullName" maxLength={120} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="inv-role">Role</FieldLabel>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger id="inv-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Instructor — teaches assigned courses</SelectItem>
                  <SelectItem value="admin">Administrator — full platform access</SelectItem>
                </SelectContent>
              </Select>
              {role === "admin" ? (
                <FieldDescription className="text-warning">Administrators can see all data, payments and settings. They must set up an authenticator app.</FieldDescription>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="inv-message">Personal message</FieldLabel>
              <Textarea id="inv-message" name="message" rows={3} maxLength={1000} placeholder="Optional — included in the email" />
            </Field>
            {role === "teacher" ? (
              <Field>
                <FieldLabel>Courses they’ll teach</FieldLabel>
                <CourseChecklist courses={courses} value={courseIds} onChange={setCourseIds} maxHeight={200} />
              </Field>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InvitationActions({ id, email, canRevoke }: { id: string; email: string; canRevoke: boolean }) {
  const router = useRouter();
  const resend = useAction(resendInvite, { onSuccess: () => router.refresh() });
  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" disabled={resend.pending} onClick={() => void resend.run({ id })}>
        <RotateCcw /> Resend
      </Button>
      {canRevoke ? (
        <ConfirmAction
          trigger={
            <Button size="sm" variant="ghost" className="text-destructive">
              <X /> Revoke
            </Button>
          }
          title={`Revoke the invitation for ${email}?`}
          description="The link in their email stops working."
          confirmLabel="Revoke invitation"
          destructive
          action={() => revokeInvite({ id })}
          onDone={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

export function PendingInstructorActions({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  return (
    <div className="flex justify-end gap-1">
      <ConfirmAction
        trigger={
          <Button size="sm">
            <Check /> Approve
          </Button>
        }
        title={`Approve ${name}?`}
        description="They get access to the instructor workspace and the courses assigned to them, and receive a confirmation email."
        confirmLabel="Approve instructor"
        action={() => approveInstructor({ userId })}
        onDone={() => router.refresh()}
      />
      <Button asChild size="sm" variant="ghost">
        <Link href={`/admin/instructors/${userId}`}>Review</Link>
      </Button>
    </div>
  );
}

export function TeachingStatusActions({ userId, name, status }: { userId: string; name: string; status: string }) {
  const router = useRouter();
  if (status === "approved") {
    return (
      <ConfirmAction
        trigger={
          <Button variant="outline" className="text-destructive">
            Suspend teaching
          </Button>
        }
        title={`Suspend ${name}'s teaching access?`}
        description="They keep their student account but lose the instructor workspace until you approve them again."
        confirmLabel="Suspend teaching"
        destructive
        requireReason
        action={({ reason }) => suspendTeaching({ userId, reason })}
        onDone={() => router.refresh()}
      />
    );
  }
  return (
    <ConfirmAction
      trigger={
        <Button>
          <Check /> {status === "suspended" ? "Reinstate as instructor" : "Approve instructor"}
        </Button>
      }
      title={`Approve ${name}?`}
      description="They get access to the instructor workspace and their assigned courses."
      confirmLabel="Approve"
      action={() => approveInstructor({ userId })}
      onDone={() => router.refresh()}
    />
  );
}

export interface InstructorProfile {
  user_id: string;
  slug: string;
  public_name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  expertise: string[];
  website_url: string | null;
  social_links: Record<string, string> | null;
  is_public: boolean;
  is_featured: boolean;
  can_create_courses: boolean;
  sort_order: number;
}

export function InstructorProfileForm({ profile }: { profile: InstructorProfile }) {
  const router = useRouter();
  const [avatar, setAvatar] = useState(profile.avatar_url ?? "");
  const [isPublic, setIsPublic] = useState(profile.is_public);
  const [featured, setFeatured] = useState(profile.is_featured);
  const [canCreate, setCanCreate] = useState(profile.can_create_courses);
  const { run, pending, fieldErrors } = useAction(saveInstructorProfile, { onSuccess: () => router.refresh() });
  const social = profile.social_links ?? {};
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void run({
          userId: profile.user_id,
          public_name: String(f.get("public_name") ?? ""),
          slug: String(f.get("slug") ?? ""),
          headline: String(f.get("headline") ?? ""),
          bio: String(f.get("bio") ?? ""),
          avatar_url: avatar,
          expertise: String(f.get("expertise") ?? ""),
          website_url: String(f.get("website_url") ?? ""),
          linkedin: String(f.get("linkedin") ?? ""),
          x: String(f.get("x") ?? ""),
          youtube: String(f.get("youtube") ?? ""),
          is_public: isPublic,
          is_featured: featured,
          can_create_courses: canCreate,
          sort_order: Number(f.get("sort_order") ?? 0),
        });
      }}
    >
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ip-name">Public name</FieldLabel>
            <Input id="ip-name" name="public_name" defaultValue={profile.public_name} required maxLength={120} />
            <FieldError>{fieldErrors.public_name?.[0]}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="ip-slug">Profile URL</FieldLabel>
            <Input id="ip-slug" name="slug" defaultValue={profile.slug} />
            <FieldDescription>/instructors/{profile.slug}</FieldDescription>
            <FieldError>{fieldErrors.slug?.[0]}</FieldError>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="ip-headline">Headline</FieldLabel>
          <Input id="ip-headline" name="headline" defaultValue={profile.headline ?? ""} maxLength={160} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ip-bio">Bio</FieldLabel>
          <Textarea id="ip-bio" name="bio" rows={5} defaultValue={profile.bio ?? ""} maxLength={8000} />
        </Field>
        <Field>
          <FieldLabel>Photo</FieldLabel>
          <ImageField value={avatar} onChange={setAvatar} aspect="aspect-square" label="Upload a photo" />
        </Field>
        <Field>
          <FieldLabel htmlFor="ip-expertise">Expertise</FieldLabel>
          <Input id="ip-expertise" name="expertise" defaultValue={(profile.expertise ?? []).join(", ")} placeholder="Shopify, Email marketing" />
          <FieldDescription>Separate with commas.</FieldDescription>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ip-web">Website</FieldLabel>
            <Input id="ip-web" name="website_url" defaultValue={profile.website_url ?? ""} placeholder="https://" />
            <FieldError>{fieldErrors.website_url?.[0]}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="ip-linkedin">LinkedIn</FieldLabel>
            <Input id="ip-linkedin" name="linkedin" defaultValue={social.linkedin ?? ""} placeholder="https://" />
            <FieldError>{fieldErrors.linkedin?.[0]}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="ip-x">X</FieldLabel>
            <Input id="ip-x" name="x" defaultValue={social.x ?? ""} placeholder="https://" />
            <FieldError>{fieldErrors.x?.[0]}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="ip-yt">YouTube</FieldLabel>
            <Input id="ip-yt" name="youtube" defaultValue={social.youtube ?? ""} placeholder="https://" />
            <FieldError>{fieldErrors.youtube?.[0]}</FieldError>
          </Field>
        </div>
        <div className="grid gap-3 rounded-xl border p-4">
          <Field orientation="horizontal">
            <Switch id="ip-public" checked={isPublic} onCheckedChange={setIsPublic} />
            <FieldLabel htmlFor="ip-public">Show on the public Instructors page</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Switch id="ip-featured" checked={featured} onCheckedChange={setFeatured} />
            <FieldLabel htmlFor="ip-featured">Feature in the home page instructor spotlight</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Switch id="ip-create" checked={canCreate} onCheckedChange={setCanCreate} />
            <FieldLabel htmlFor="ip-create">Can create new course drafts</FieldLabel>
          </Field>
          <Field className="sm:w-40">
            <FieldLabel htmlFor="ip-sort">Sort order</FieldLabel>
            <Input id="ip-sort" name="sort_order" type="number" min={0} defaultValue={profile.sort_order} />
          </Field>
        </div>
      </FieldGroup>
      <Button type="submit" className="mt-6" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export interface Assignment {
  course_id: string;
  title: string;
  status: string;
  role: "lead" | "assistant";
  can_edit: boolean;
}

export function CourseAssignments({ userId, assignments, courses }: {
  userId: string;
  assignments: Assignment[];
  courses: { id: string; title: string; status: string }[];
}) {
  const router = useRouter();
  const [courseId, setCourseId] = useState("");
  const [role, setRole] = useState<"lead" | "assistant">("lead");
  const save = useAction(assignCourse, {
    onSuccess: () => {
      setCourseId("");
      router.refresh();
    },
  });
  const available = courses.filter((c) => !assignments.some((a) => a.course_id === c.id));
  return (
    <div className="grid gap-4">
      {assignments.length === 0 ? (
        <EmptyState title="No courses assigned" description="Assign a course so this instructor can manage it." className="py-8" />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Can edit</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => (
                <TableRow key={a.course_id}>
                  <TableCell>
                    <Link href={`/admin/courses/${a.course_id}`} className="font-medium hover:underline">
                      {a.title}
                    </Link>
                    <StatusBadge status={a.status} className="ml-2" />
                  </TableCell>
                  <TableCell>
                    <Select value={a.role} onValueChange={(v) => void save.run({ userId, courseId: a.course_id, role: v as "lead" | "assistant", canEdit: a.can_edit })}>
                      <SelectTrigger size="sm" className="w-32" aria-label="Role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="assistant">Assistant</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={a.can_edit}
                      onCheckedChange={(v) => void save.run({ userId, courseId: a.course_id, role: a.role, canEdit: v })}
                      aria-label={`Can edit ${a.title}`}
                    />
                  </TableCell>
                  <TableCell>
                    <ConfirmAction
                      trigger={
                        <Button size="icon-sm" variant="ghost" aria-label={`Remove from ${a.title}`}>
                          <Trash2 />
                        </Button>
                      }
                      title={`Remove from ${a.title}?`}
                      description="They lose access to this course's content, students and discussions."
                      confirmLabel="Remove"
                      destructive
                      action={() => unassignCourse({ userId, courseId: a.course_id })}
                      onDone={() => router.refresh()}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={courseId} onValueChange={setCourseId}>
          <SelectTrigger className="sm:flex-1" aria-label="Course to assign">
            <SelectValue placeholder={available.length ? "Choose a course" : "All courses assigned"} />
          </SelectTrigger>
          <SelectContent>
            {available.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={(v) => setRole(v as "lead" | "assistant")}>
          <SelectTrigger className="sm:w-36" aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="assistant">Assistant</SelectItem>
          </SelectContent>
        </Select>
        <Button disabled={!courseId || save.pending} onClick={() => void save.run({ userId, courseId, role, canEdit: true })}>
          Assign course
        </Button>
      </div>
    </div>
  );
}
