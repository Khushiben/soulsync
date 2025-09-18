// pages/chat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useSettings } from '@/contexts/SettingsContext';
import { getChatHistory, saveChatHistory, getChatResponse } from '@/lib/storage';
import { ChatMessage } from '@/types';

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { aiTone, responseLength } = useSettings();

  // Helper: call API to translate text
  const translateText = async (text: string, targetLang: string): Promise<string> => {
    if (targetLang === 'en') return text;
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang }),
      });
      const data = await res.json();
      return data.translatedText || text;
    } catch (err) {
      console.error('Translation error:', err);
      return text;
    }
  };

  // Load chat history or welcome message
  useEffect(() => {
    const history = getChatHistory();
    if (history.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Hello! I'm your MindMate AI assistant. I'm here to listen, provide support, and offer wellness guidance. How are you feeling today?",
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
      saveChatHistory([welcomeMessage]);
      speakText(welcomeMessage.content);
    } else {
      setMessages(history);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => setInput(event.results[0][0].transcript);

    recognitionRef.current = recognition;
  }, []);

  // Speak text
  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = selectedLanguage;
      utterance.pitch = 1;
      utterance.rate = 1;
      utterance.volume = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Translate all messages when language changes
  useEffect(() => {
    const translateAllMessages = async () => {
      if (messages.length === 0) return;
      const translatedMessages: ChatMessage[] = [];
      for (const msg of messages) {
        const translatedContent = await translateText(msg.content, selectedLanguage);
        translatedMessages.push({ ...msg, content: translatedContent });
      }
      setMessages(translatedMessages);
    };
    translateAllMessages();
  }, [selectedLanguage]);

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsProcessing(true);

    try {
      const response = await getChatResponse(updatedMessages, aiTone, responseLength);
      const translatedResponse = await translateText(response, selectedLanguage);

      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: translatedResponse,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveChatHistory(finalMessages);

      speakText(translatedResponse);
    } catch {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I'm sorry, I had trouble processing your message. Could you try again?",
        timestamp: new Date().toISOString(),
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    const welcomeMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: "Hello! I'm your MindMate AI assistant. I'm here to listen, provide support, and offer wellness guidance. How are you feeling today?",
      timestamp: new Date().toISOString(),
    };
    setMessages([welcomeMessage]);
    saveChatHistory([welcomeMessage]);
    speakText(welcomeMessage.content);
  };

  const handleVoiceInput = () => {
    if (!recognitionRef.current) return alert('Speech Recognition is not supported.');
    if (!isListening) recognitionRef.current.start();
    else recognitionRef.current.stop();
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">AI Chat</h1>
      <Card className="flex-1 flex flex-col overflow-hidden rounded-xl shadow-lg border-2 border-primary/10">
        <div className="p-4 border-b border-border flex justify-between items-center bg-gradient-to-r from-primary/10 to-secondary/10">
          <div className="flex items-center">
            <div className="bg-white dark:bg-card p-3 rounded-full shadow-sm">
              <i className="fas fa-robot text-primary text-xl"></i>
            </div>
            <div className="ml-3">
              <h3 className="font-heading font-medium text-lg">MindMate Assistant</h3>
              <p className="text-xs text-muted-foreground">AI-powered wellness support</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Language" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="gu">Gujarati</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (isSpeaking ? stopSpeaking() : speakText(messages[messages.length - 1]?.content))}
              className="rounded-full hover:bg-white/20 dark:hover:bg-card/20"
            >
              <i className={`fas ${isSpeaking ? "fa-stop" : "fa-play"}`}></i>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="rounded-full hover:bg-white/20 dark:hover:bg-card/20"
            >
              <i className="fas fa-redo-alt"></i>
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex items-start ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="bg-white dark:bg-card p-2 rounded-full shadow-sm border border-primary/20">
                  <i className="fas fa-robot text-primary text-lg"></i>
                </div>
              )}
              <div
                className={`mx-3 py-3 px-5 rounded-xl max-w-[80%] shadow-sm chat-message ${
                  msg.role === 'user'
                    ? 'chat-message-user bg-gradient-to-br from-primary to-secondary text-primary-foreground rounded-br-none'
                    : 'chat-message-ai bg-muted/50 rounded-bl-none'
                }`}
              >
                <p>{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="bg-gradient-to-br from-primary to-secondary p-2 rounded-full shadow-sm">
                  <i className="fas fa-user text-white text-lg"></i>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-border">
          <form onSubmit={handleSubmit} className="flex items-center space-x-3">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type or speak your message..."
              disabled={isProcessing}
              className="flex-1 h-12 pl-4 pr-4 border-2 border-primary/10 focus-visible:ring-primary/30 rounded-full text-lg"
            />
            <Button
              type="button"
              onClick={handleVoiceInput}
              className={`btn rounded-full h-12 w-12 p-0 ${
                isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-primary to-secondary'
              } text-white`}
              title={isListening ? 'Stop listening' : 'Start speaking'}
            >
              <i className={`fas ${isListening ? 'fa-microphone-slash' : 'fa-microphone'} text-lg`}></i>
            </Button>
            <Button
              type="submit"
              disabled={isProcessing}
              className="btn rounded-full h-12 w-12 p-0 bg-gradient-to-r from-primary to-secondary hover:shadow-lg text-white"
            >
              {isProcessing ? (
                <i className="fas fa-spinner fa-spin text-lg"></i>
              ) : (
                <i className="fas fa-paper-plane text-lg"></i>
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            <i className="fas fa-lock mr-1"></i> Your conversations are private and stored locally on your device only.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Chat;
