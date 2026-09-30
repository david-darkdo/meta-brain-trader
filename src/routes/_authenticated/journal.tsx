import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  BookOpen,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Edit3,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({ meta: [{ title: "Personal Journal — MetaBrain Notebook" }] }),
  component: PersonalJournal,
});

interface JournalNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function PersonalJournal() {
  const qc = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch all user journal notes (newest first)
  const notesQ = useQuery({
    queryKey: ["journal_notes"],
    queryFn: async (): Promise<JournalNote[]> => {
      const { data, error } = await supabase
        .from("journal_notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as JournalNote[];
    },
  });

  // Save / Update Note Mutation
  const saveNoteMut = useMutation({
    mutationFn: async () => {
      const cleanTitle = title.trim();
      const cleanContent = content.trim();
      if (!cleanTitle) throw new Error("Please provide a title for your note.");
      if (!cleanContent) throw new Error("Please write some content before saving.");

      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("You must be logged in to save notes.");

      if (editingNoteId) {
        // Update existing note
        const { data, error } = await supabase
          .from("journal_notes")
          .update({
            title: cleanTitle,
            content: cleanContent,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingNoteId)
          .select()
          .single();

        if (error) throw error;
        return data as JournalNote;
      } else {
        // Create new note
        const { data, error } = await supabase
          .from("journal_notes")
          .insert({
            user_id: userId,
            title: cleanTitle,
            content: cleanContent,
          })
          .select()
          .single();

        if (error) throw error;
        return data as JournalNote;
      }
    },
    onSuccess: () => {
      toast.success(editingNoteId ? "Note updated successfully" : "Note saved to your journal");
      qc.invalidateQueries({ queryKey: ["journal_notes"] });
      handleCloseEditor();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save note");
    },
  });

  // Delete Note Mutation
  const deleteNoteMut = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id);
      const { error } = await supabase
        .from("journal_notes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      toast.success("Note deleted");
      qc.invalidateQueries({ queryKey: ["journal_notes"] });
      if (editingNoteId === deletedId) {
        handleCloseEditor();
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete note");
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  function handleOpenNew() {
    setEditingNoteId(null);
    setTitle("");
    setContent("");
    setIsEditorOpen(true);
    // Smooth scroll to top of page where editor is rendered
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleOpenEdit(note: JournalNote) {
    setEditingNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setIsEditorOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCloseEditor() {
    setIsEditorOpen(false);
    setEditingNoteId(null);
    setTitle("");
    setContent("");
  }

  const notes = notesQ.data ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. HEADER & NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/validator"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1.5 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Meta Validator
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 text-amber-400" />
            Personal Journal
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Your private trading notebook. Record mental models, lessons, and market psychology.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isEditorOpen && (
            <Button
              type="button"
              onClick={handleOpenNew}
              className="gold-gradient-btn text-xs font-semibold h-9 px-4 shadow-[0_2px_12px_rgba(245,158,11,0.2)]"
            >
              <Plus className="h-4 w-4 mr-1.5" /> New Entry
            </Button>
          )}
        </div>
      </div>

      {/* 2. TEMPORARY NOTE EDITOR (TOP OF PAGE WHEN OPEN) */}
      {isEditorOpen && (
        <Card className="border border-amber-500/30 bg-card/95 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.25)] rounded-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-amber-400" />
                <CardTitle className="text-sm font-semibold tracking-wide text-foreground">
                  {editingNoteId ? "Edit Journal Entry" : "New Journal Entry"}
                </CardTitle>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCloseEditor}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Cancel / Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. London Session Discipline & Liquidity Sweep..."
                className="text-base font-semibold bg-secondary/40 border-border focus-visible:ring-amber-400"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notebook Content</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Today I noticed that I entered before 15m candle close confirmation. Next time, wait for the liquidity sweep..."
                rows={8}
                className="bg-secondary/40 border-border focus-visible:ring-amber-400 font-sans text-sm leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseEditor}
                disabled={saveNoteMut.isPending}
                className="text-xs border-border/80 text-muted-foreground hover:text-foreground h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => saveNoteMut.mutate()}
                disabled={saveNoteMut.isPending || !title.trim() || !content.trim()}
                className="gold-gradient-btn text-xs font-semibold h-9 px-4"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saveNoteMut.isPending
                  ? "Saving..."
                  : editingNoteId
                    ? "Update Note"
                    : "Save Note"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. SAVED NOTES LIST (NEWEST FIRST) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Saved Entries ({notes.length})
          </h2>
        </div>

        {notesQ.isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground rounded-2xl border border-border/60 bg-card/40">
            Loading your notebook entries...
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center bg-card/30">
            <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground">No journal entries yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Start recording your mental models, psychological observations, and trade reflections.
            </p>
            <Button
              size="sm"
              onClick={handleOpenNew}
              className="mt-4 gold-gradient-btn text-xs font-semibold h-9 px-4"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> + New Entry
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => {
              const formattedDate = new Date(note.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const formattedTime = new Date(note.created_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <Card
                  key={note.id}
                  className="border border-border/70 bg-card/70 hover:bg-card/90 transition-all rounded-xl overflow-hidden group shadow-sm"
                >
                  <CardHeader className="py-3 px-4 sm:px-5 border-b border-border/40 bg-secondary/15 flex flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                      <span className="text-amber-400 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formattedDate}
                      </span>
                      <span className="flex items-center gap-1 hidden xs:inline-flex">
                        <Clock className="h-3.5 w-3.5" />
                        {formattedTime}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(note)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10"
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                            disabled={deletingId === note.id}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-foreground">
                              Delete Note?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to permanently delete "{note.title}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteNoteMut.mutate(note.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 space-y-2">
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      {note.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap font-sans">
                      {note.content}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
