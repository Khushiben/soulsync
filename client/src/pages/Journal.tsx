import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import EmptyState from '@/components/EmptyState';
import { saveJournalEntry, getJournalEntries, analyzeJournalEntry } from '@/lib/storage';
import { JournalEntry } from '@/types';
import { formatDate } from '@/lib/utils';

const Journal: React.FC = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentUtterance, setCurrentUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = () => {
    const journalEntries = getJournalEntries();
    setEntries(journalEntries);
  };

  const handleSaveDraft = () => {
    if (!title.trim() || !content.trim()) {
      toast({
        description: "Please add both a title and content for your journal entry.",
        variant: "destructive"
      });
      return;
    }

    const entry: JournalEntry = {
      id: Date.now().toString(),
      title,
      content,
      date: new Date().toISOString(),
      tags: [],
      analysis: null
    };

    saveJournalEntry(entry);
    toast({
      description: "Journal entry saved successfully!",
    });

    setTitle('');
    setContent('');
    loadEntries();
  };

  const handleAnalyze = async () => {
    if (!content.trim()) {
      toast({
        description: "Please write something in your journal to analyze.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const entryTitle = title || "Untitled Entry";
      const analysis = await analyzeJournalEntry(content);

      const entry: JournalEntry = {
        id: Date.now().toString(),
        title: entryTitle,
        content,
        date: new Date().toISOString(),
        tags: analysis.tags || [],
        analysis: analysis.insights || "No insights available"
      };

      saveJournalEntry(entry);
      toast({
        description: "Journal entry analyzed and saved!",
      });

      setTitle('');
      setContent('');
      loadEntries();
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: "Could not analyze your journal entry. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Cancel any existing speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';

      utterance.onend = () => {
        setCurrentUtterance(null);
      };

      setCurrentUtterance(utterance);
      window.speechSynthesis.speak(utterance);
    } else {
      toast({
        title: "Text-to-Speech not supported",
        description: "Your browser does not support speech synthesis.",
        variant: "destructive"
      });
    }
  };

  const handlePause = () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Journal</h1>

      {/* Journal entry form */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-3">New Entry</h2>
          <div className="mb-4">
            <Input
              className="text-lg font-heading border-2 border-primary/10 h-12 px-4 focus-visible:ring-primary/30"
              placeholder="Entry title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <Textarea
              className="journal text-lg leading-relaxed border-2 border-primary/10 p-4 min-h-[200px] focus-visible:ring-primary/30"
              placeholder="How are you feeling today? Write your thoughts here..."
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleSaveDraft} className="btn rounded-full hover:bg-primary/10">
              <i className="fas fa-save mr-2"></i> Save Draft
            </Button>
            <Button onClick={handleAnalyze} disabled={isAnalyzing} className="btn rounded-full bg-gradient-to-r from-primary to-secondary hover:shadow-lg">
              {isAnalyzing ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i> Analyzing...
                </>
              ) : (
                <>
                  <i className="fas fa-brain mr-2"></i> Analyze with AI
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Previous entries */}
      <h2 className="text-xl font-semibold mb-4">Previous Entries</h2>

      {entries.length === 0 ? (
        <EmptyState
          icon="fas fa-book"
          title="No Journal Entries Yet"
          description="Write your first journal entry above to get started. Your entries will appear here."
        />
      ) : (
        entries.map(entry => (
          <Card key={entry.id} className="mb-6 hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary overflow-hidden">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-medium text-xl font-heading">{entry.title}</h3>
                <span className="text-sm text-muted-foreground bg-primary/5 px-2 py-1 rounded-full">{formatDate(entry.date)}</span>
              </div>
              <p className="font-journal text-muted-foreground mb-4 leading-relaxed">{entry.content}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-3">
                {entry.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* AI analysis with TTS (Play & Pause only) */}
              {entry.analysis && (
                <div className="mt-3 p-3 bg-primary/5 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-sm font-semibold">AI Analysis</h4>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSpeak(entry.analysis || '')}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <i className="fas fa-play"></i> Play
                      </button>
                      <button
                        onClick={handlePause}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <i className="fas fa-pause"></i> Pause / Resume
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.analysis}</p>
                </div>
              )}

              <div className="flex justify-end mt-3">
                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 rounded-full">
                  <i className="fas fa-book-open mr-1"></i> Read more
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default Journal;