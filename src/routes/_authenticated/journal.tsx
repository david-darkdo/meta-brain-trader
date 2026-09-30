import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Sparkles,
  Edit3,
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
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch all user journal notes
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

      if (selectedNoteId) {
        // Update existing note
        const { data, error } = await supabase
          .from("journal_notes")
          .update({
            title: cleanTitle,
            content: cleanContent,
          })
          .eq("id", selectedNoteId)
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
    onSuccess: (saved) => {
      toast.success(selectedNoteId ? "Note updated" : "Note saved to your journal");
      qc.invalidateQueries({ queryKey: ["journal_notes"] });
      setSelectedNoteId(saved.id);
      setIsCreating(false);
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
    onSuccess: () => {
      toast.success("Note deleted");
      qc.invalidateQueries({ queryKey: ["journal_notes"] });
      if (selectedNoteId === deletingId) {
        handleStartNew();
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete note");
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  function handleSelectNote(note: JournalNote) {
    setSelectedNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setIsCreating(false);
  }

  function handleStartNew() {
    setSelectedNoteId(null);
    setTitle("");
    setContent("");
    setIsCreating(true);
  }

  const activeNote = notesQ.data?.find((n) => n.id === selectedNoteId);

  return (
    <div className="space-y-6">
      {/* 1. HEADER & NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/validator"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Meta Validator
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-amber-400" />
            Personal Journal
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Your private trading notebook. Record mental models, lessons, and market psychology.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleStartNew}
            className="gold-gradient-btn text-xs h-9"
          >
            <Plus className="h-4 w-4 mr-1" /> New Entry
          </Button>
        </div>
      </div>

      {/* 2. MAIN NOTEBOOK WORKSPACE: 2-COLUMN SPLIT */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: NOTES LIST (4 COLS) */}
        <div className="md:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Journal Entries ({notesQ.data?.length ?? 0})
            </h2>
          </div>

          {notesQ.isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground rounded-xl border border-border/60 bg-card/40">
              Loading your notes...
            </div>
          ) : !notesQ.data || notesQ.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-6 text-center bg-card/30">
              <FileText className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Your journal is empty.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartNew}
                className="mt-3 text-xs border-amber-500/30 text-amber-400"
              >
                Write your first note
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {notesQ.data.map((note) => {
                const isSelected = note.id === selectedNoteId;
                const formattedDate = new Date(note.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div
                    key={note.id}
                    onClick={() => handleSelectNote(note)}
                    className={`group relative flex flex-col justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-amber-400/60 bg-card shadow-[0_4px_16px_rgba(245,158,11,0.08)]"
                        : "border-border/70 bg-card/60 hover:bg-card hover:border-border"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-amber-400/90 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formattedDate}
                        </span>

                        <AlertDialog>
                          <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-400 p-1 rounded transition-opacity"
                              title="Delete note"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-foreground">Delete Note?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{note.title}"? This cannot be undone.
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

                      <h3 className="text-sm font-bold text-foreground truncate group-hover:text-amber-400 transition-colors">
                        {note.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {note.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: NOTE WRITING / EDITING CANVAS (8 COLS) */}
        <div className="md:col-span-8">
          <Card className="border-border/80 bg-card/80 backdrop-blur-md">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {selectedNoteId ? "Edit Journal Entry" : "New Journal Entry"}
                  </span>
                </div>
                {activeNote && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    Recorded {new Date(activeNote.created_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. London Session Discipline & Patience..."
                  className="text-base font-semibold bg-secondary/40 border-border focus-visible:ring-amber-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Notebook Content</label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Today I noticed that I entered before 15m candle close confirmation. Next time, wait for the liquidity sweep..."
                  rows={12}
                  className="bg-secondary/40 border-border focus-visible:ring-amber-400 font-sans text-sm leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  {selectedNoteId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Entry
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-foreground">Delete Entry?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to permanently delete this journal entry?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => selectedNoteId && deleteNoteMut.mutate(selectedNoteId)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => saveNoteMut.mutate()}
                    disabled={saveNoteMut.isPending || !title.trim() || !content.trim()}
                    className="gold-gradient-btn text-xs font-semibold h-9 px-4"
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {saveNoteMut.isPending ? "Saving..." : selectedNoteId ? "Update Note" : "Save Note"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
