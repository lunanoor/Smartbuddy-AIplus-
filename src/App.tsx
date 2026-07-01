import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Search, Download, Presentation, Layout, Share2, Info, ChevronRight, BookOpen, ExternalLink, Loader2, MessageSquare, Send, Sparkles } from 'lucide-react';
import { extractTextFromPdf, processTextIntoSlides } from './services/pdfService';
import type { SlideContent } from './services/pdfService';
import { searchOSFResources } from './services/osfService';
import type { OSFResource } from './services/osfService';
import { generatePptx } from './services/pptxService';
import { getAIResponse, generateSummary } from './services/aiService';
import type { ChatMessage } from './services/aiService';
import './index.css';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [slides, setSlides] = useState<SlideContent[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [osfResults, setOsfResults] = useState<OSFResource[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [pdfText, setPdfText] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Handle PDF Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let uploadedFile: File | null = null;
    if ('files' in e.target && e.target.files) {
      uploadedFile = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      uploadedFile = e.dataTransfer.files[0];
    }

    if (uploadedFile && uploadedFile.type === 'application/pdf') {
      setFile(uploadedFile);
      setIsProcessing(true);
      try {
        const text = await extractTextFromPdf(uploadedFile);
        setPdfText(text);
        const generatedSlides = processTextIntoSlides(text);
        setSlides(generatedSlides);

        // Start AI Summary (non-blocking: don't fail PDF processing if AI errors)
        try {
          const aiSummary = await generateSummary(text);
          setSummary(aiSummary);
        } catch (aiError: any) {
          console.error('AI summary error:', aiError);
          setSummary(`AI summary unavailable: ${aiError.message || 'Check API key or connection.'}`);
        }

        // Initialize Chat with System Prompt
        setChatMessages([
          { role: 'assistant', content: `Hello! I've analyzed "${uploadedFile.name}". I've generated ${generatedSlides.length} slides and a summary for you. You can ask me anything about the document or ask me to refine the slides!` }
        ]);
      } catch (error: any) {
        console.error('Processing error:', error);
        alert(`Failed to process PDF: ${error.message || 'Unknown error'}. Please ensure it's a valid, non-encrypted PDF file.`);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const fullContext: ChatMessage[] = [
        { role: 'system', content: `You are SmartBuddy AI, a research assistant. You have access to the following document text: ${pdfText.slice(0, 15000)}. Answer questions based on this text. If asked to refine slides, suggest new titles or bullet points.` },
        ...newMessages
      ];

      const response = await getAIResponse(fullContext);
      setChatMessages([...newMessages, { role: 'assistant', content: response }]);
    } catch (error: any) {
      console.error('Chat error:', error);
      setChatMessages([...newMessages, { role: 'assistant', content: `Error: ${error.message || "I'm sorry, I encountered an error connecting to the AI service. Please check your API key or connection."}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handle OSF Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearching(true);
        const results = await searchOSFResources(searchQuery);
        setOsfResults(results);
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleExport = async () => {
    if (slides.length > 0 && file) {
      await generatePptx(slides, file.name);
    }
  };

  return (
    <div className="min-h-screen flex text-white overflow-hidden bg-[#020617]">
      {/* Sidebar - OSF Search Interface */}
      <aside className="w-80 glass-morphism m-4 mr-0 p-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-xl">
            <Search size={20} />
          </div>
          <h2 className="text-xl font-semibold">OSF Research</h2>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search papers, datasets..."
            className="w-full bg-white-5 border border-white-10 rounded-lg py-2 px-4 focus:outline-none focus:border-primary-50 transition-all"
          />
          {isSearching && <Loader2 size={16} className="absolute right-3 top-3 animate-spin text-primary" />}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {osfResults.length > 0 ? osfResults.map((res) => (
            <div key={res.id} className="p-4 rounded-xl bg-white-5 border border-white-5 hover-border-primary-30 transition-all cursor-pointer group">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] uppercase tracking-wider text-accent font-bold">{res.type}</span>
                <a href={res.url} target="_blank" rel="noreferrer"><ExternalLink size={12} className="text-text-muted hover:text-white" /></a>
              </div>
              <h3 className="text-sm font-medium group-hover-text-primary transition-colors line-clamp-2">{res.title}</h3>
              <p className="text-[11px] text-text-muted mt-2 italic line-clamp-1">{res.date} • {res.author}</p>
            </div>
          )) : (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-text-muted border border-dashed border-white-10 rounded-xl">
              <BookOpen size={24} className="mb-2 opacity-20" />
              <p className="text-xs">Search for related academic materials on OSF</p>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 border-t border-white-10">
          <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">OSF API v2 • Sandbox</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 flex flex-col gap-4 relative">
        <header className="flex justify-between items-center px-4 py-2">
          <div className="flex items-center gap-2">
            <Presentation className="text-primary" />
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold gradient-text">SmartBuddy</h1>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">AI PLUS</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-white-5 hover-bg-white-10 px-4 py-2 font-medium">
              <Share2 size={18} />
              Share
            </button>
            <button
              onClick={handleExport}
              disabled={slides.length === 0}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold shadow-lg transition-all ${slides.length > 0 ? 'bg-primary hover:bg-primary-80 shadow-primary-20' : 'bg-white-5 text-white-20 cursor-not-allowed'}`}
            >
              <Download size={18} />
              Export PPTX
            </button>
          </div>
        </header>

        {/* Dynamic Content Switching */}
        <section className="flex-1 flex flex-col gap-6 overflow-y-auto p-4 custom-scrollbar">
          {!file ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-8 glass-morphism relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-primary-10 rounded-full blur-120px neg-mr-48 neg-mt-48"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-5 rounded-full blur-120px neg-ml-48 neg-mb-48"></div>

              <div className="max-w-xl w-full p-12 flex flex-col items-center text-center gap-6 animate-fade-in z-10">
                <div className="w-24 h-24 bg-primary-20 rounded-3xl flex items-center justify-center border border-primary-10 shadow-2xl shadow-primary-10">
                  <Upload size={40} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold mb-2 text-white">Transform your PDF</h2>
                  <p className="text-text-muted">Generate slides and chat interactive with your documents using Gemini Pro-powered intelligence.</p>
                </div>

                <label
                  onDragOver={(e) => { e.preventDefault(); setIsUploading(true); }}
                  onDragLeave={() => setIsUploading(false)}
                  onDrop={(e) => { e.preventDefault(); setIsUploading(false); handleFileUpload(e); }}
                  className={`w-full h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${isUploading ? 'border-primary bg-primary-5' : 'border-white-10 hover:border-white-20'}`}
                >
                  <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                  <FileText size={32} className={isUploading ? 'text-primary' : 'text-white-20'} />
                  <span className="text-sm font-medium">{isUploading ? 'Drop it here!' : 'Click to Browse or Drop PDF'}</span>
                </label>
              </div>
            </div>
          ) : isProcessing ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 glass-morphism">
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <h3 className="text-xl font-medium">Empowering your Document...</h3>
              <p className="text-text-muted text-sm italic">AI is extracting insights and crafting slides</p>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-6 animate-fade-in">
              <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
                <div className="glass-morphism p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-accent" size={20} />
                    <h2 className="text-xl font-bold">AI Summary</h2>
                  </div>
                  {summary ? (
                    <p className="text-sm text-text-muted leading-relaxed italic border-l-2 border-accent/30 pl-4 py-2">
                      {summary}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <Loader2 size={12} className="animate-spin" />
                      Generating summary...
                    </div>
                  )}
                </div>

                <div className="glass-morphism p-4 flex flex-col gap-4 flex-1 min-h-[500px]">
                  <div className="flex items-center gap-2 px-2">
                    <MessageSquare className="text-primary" size={18} />
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white/70">Chat with Doc</h2>
                  </div>

                  <div className="chat-container">
                    <div className="messages-list custom-scrollbar">
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`message-bubble ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}>
                          {msg.content}
                        </div>
                      ))}
                      {isChatLoading && (
                        <div className="message-bubble message-assistant italic opacity-50 flex items-center gap-2">
                          <Loader2 size={12} className="animate-spin" />
                          Doc is thinking...
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="chat-input-area">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask about this document..."
                        className="chat-input"
                        disabled={isChatLoading}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={isChatLoading || !chatInput.trim()}
                        className={`p-2 rounded-lg transition-all ${chatInput.trim() ? 'bg-primary text-white hover:scale-105' : 'bg-white-5 text-white-20'}`}
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
                <div className="flex justify-between items-center px-2">
                  <div className="flex items-center gap-2">
                    <Layout className="text-primary" size={20} />
                    <h2 className="text-xl font-bold text-white">Generated Slides ({slides.length})</h2>
                  </div>
                </div>

                <div className="slide-grid">
                  {slides.map((slide, i) => (
                    <div key={i} className="slide-card group hover-border-primary-30 transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-bold text-primary/50 uppercase tracking-tighter">Slide {i + 1}</span>
                        <ChevronRight size={14} className="text-white/10 group-hover:text-primary transition-colors" />
                      </div>
                      <h4 className="font-bold text-sm mb-4 text-primary line-clamp-2">{slide.title}</h4>
                      <ul className="space-y-2">
                        {slide.points.map((p, j) => (
                          <li key={j} className="text-[11px] text-text-muted flex gap-2">
                            <span className="text-primary">•</span>
                            <span className="line-clamp-4">{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Bottom Status Bar */}
        <footer className="h-10 glass-morphism flex items-center px-6 justify-between text-[10px] text-text-muted">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><div className={`w-1 h-1 rounded-full ${file ? 'bg-accent' : 'bg-primary'}`}></div> {file ? file.name : 'Waiting for document'}</span>
            <span className="flex items-center gap-1"><div className="w-1 h-1 bg-accent rounded-full"></div> PDF Engine Active</span>
            <span className="flex items-center gap-1"><div className="w-1 h-1 bg-primary rounded-full"></div> OpenRouter AI Active</span>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-1.5 bg-white-5 px-2 py-0.5 rounded-full border border-white-5 shadow-sm">
              <Info size={10} />
              <span>SmartBuddy v1.2 • Gemini Pro</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
