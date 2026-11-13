"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { GrantAccessForm, UserPicker } from "@/components/admin/students/student-actions";

export function ManualEnrollDialog({ courses }: { courses: { id: string; title: string; status: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<{ id: string; full_name: string; email: string } | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setStudent(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Enroll a student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll a student</DialogTitle>
          <DialogDescription>Creates an enrollment and access without a payment. The reason is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <Field className="mb-4">
          <FieldLabel>Student</FieldLabel>
          <UserPicker value={student} onChange={setStudent} />
        </Field>
        <GrantAccessForm
          userId={student?.id ?? null}
          courses={courses}
          submitLabel="Enroll student"
          onDone={() => {
            setOpen(false);
            setStudent(null);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
