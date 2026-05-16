import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Paperclip, Image as ImageIcon, FileText, MoreVertical, Download, Search, ChevronLeft, Check, CheckCheck, User as UserIcon } from 'lucide-react';
import { User, ChatMessage } from '../types';
import { db } from '../services/db';

interface InternalChatProps {
    currentUser: User;
    isOpen: boolean;
    onClose: () => void;
    onUnreadChange: (count: number) => void;
    onShowToast: (toast: { title: string, message: string }) => void;
}

export const InternalChat: React.FC<InternalChatProps> = ({ currentUser, isOpen, onClose, onUnreadChange, onShowToast }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null); // null = General
    const [viewMode, setViewMode] = useState<'LIST' | 'CHAT'>('LIST'); // For mobile/small views
    const [searchTerm, setSearchTerm] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<{ name: string, data: string, type: 'image' | 'file' } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Helper: Update Global Count
    const updateGlobalCount = (counts: Record<string, number>) => {
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        onUnreadChange(total);
    };

    // Auto-switch to CHAT mode if recipient selected on desktop
    useEffect(() => {
        if (selectedRecipient !== undefined) {
            setViewMode('CHAT');
        }
    }, [selectedRecipient]);

    // Handle Read Status
    useEffect(() => {
        if (isOpen && selectedRecipient) {
            setUnreadCounts(prev => {
                const newCounts = { ...prev, [selectedRecipient]: 0 };
                updateGlobalCount(newCounts);
                return newCounts;
            });
            db.markMessagesAsRead(currentUser.username, selectedRecipient);
        } else if (isOpen && selectedRecipient === null) {
            setUnreadCounts(prev => {
                const newCounts = { ...prev, 'general': 0 };
                updateGlobalCount(newCounts);
                return newCounts;
            });
            db.markGeneralChatRead(currentUser.username);
        }
    }, [selectedRecipient, isOpen, currentUser.username]);

    // Load Data
    useEffect(() => {
        const loadData = async () => {
            try {
                const [msgs, users] = await Promise.all([db.getMessages(), db.getAppUsers()]);
                setMessages(msgs);
                setAvailableUsers(users.filter(u => u.username !== currentUser.username && u.role !== 'ALCALDE'));

                const me = users.find(u => u.username === currentUser.username);
                const myLastReadGeneral = me?.last_read_general_chat;
                const initialCounts: Record<string, number> = {};
                
                msgs.forEach(m => {
                    if (m.sender_username !== currentUser.username) {
                        if (m.recipient_username === currentUser.username) {
                            if (!m.is_read) initialCounts[m.sender_username] = (initialCounts[m.sender_username] || 0) + 1;
                        } else if (m.recipient_username === null) {
                            if (!myLastReadGeneral || new Date(m.created_at) > new Date(myLastReadGeneral)) {
                                initialCounts['general'] = (initialCounts['general'] || 0) + 1;
                            }
                        }
                    }
                });
                setUnreadCounts(initialCounts);
                updateGlobalCount(initialCounts);
            } catch (error) {
                console.error("Chat load error:", error);
            }
        };
        loadData();
    }, [currentUser.username]);

    // Subscription
    useEffect(() => {
        const unsub = db.subscribeToChanges(
            () => { }, () => { }, () => { }, () => { },
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMsg = payload.new as ChatMessage;
                    setMessages(prev => [...prev, newMsg]);

                    if (newMsg.sender_username !== currentUser.username) {
                        const isForMe = newMsg.recipient_username === currentUser.username;
                        const isGeneral = newMsg.recipient_username === null;
                        const countKey = isForMe ? newMsg.sender_username : (isGeneral ? 'general' : null);

                        if (countKey) {
                            const isViewing = isOpen && viewMode === 'CHAT' && (
                                (countKey === 'general' && selectedRecipient === null) ||
                                (countKey === newMsg.sender_username && selectedRecipient === newMsg.sender_username)
                            );

                            if (!isViewing) {
                                setUnreadCounts(prev => {
                                    const next = { ...prev, [countKey]: (prev[countKey] || 0) + 1 };
                                    updateGlobalCount(next);
                                    return next;
                                });
                                new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3').play().catch(() => {});
                                onShowToast({ title: 'Mensaje de ' + newMsg.sender_name, message: newMsg.content || '📎 Adjunto' });
                            } else {
                                if (isGeneral) db.markGeneralChatRead(currentUser.username);
                                else db.markMessagesAsRead(currentUser.username, newMsg.sender_username);
                            }
                        }
                    }
                }
            }
        );
        return () => unsub();
    }, [isOpen, viewMode, selectedRecipient, currentUser.username]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, selectedRecipient, viewMode]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() && !selectedFile) return;

        try {
            await db.sendMessage({
                sender_username: currentUser.username,
                sender_name: currentUser.name,
                content: newMessage,
                recipient_username: selectedRecipient,
                attachment_url: selectedFile?.data,
                attachment_type: selectedFile?.type
            });
            setNewMessage('');
            setSelectedFile(null);
        } catch (e) {
            alert("Error al enviar");
        }
    };

    const activeMessages = messages.filter(msg => {
        if (selectedRecipient) {
            return (msg.sender_username === currentUser.username && msg.recipient_username === selectedRecipient) ||
                (msg.sender_username === selectedRecipient && msg.recipient_username === currentUser.username);
        }
        return msg.recipient_username === null;
    });

    const filteredContacts = availableUsers.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRecipientName = () => {
        if (selectedRecipient === null) return "Canal General SIGMA";
        const user = availableUsers.find(u => u.username === selectedRecipient);
        return user?.name || "Usuario";
    };

    if (currentUser.role === 'ALCALDE') return null;

    return (
        <div className={`fixed bottom-24 right-6 w-[400px] h-[600px] bg-white rounded-2xl shadow-2xl z-[100] transition-all duration-300 transform origin-bottom-right border border-slate-200 overflow-hidden flex flex-col ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-10 pointer-events-none'}`}>
            
            {/* VIEW: CONTACT LIST */}
            {viewMode === 'LIST' && (
                <div className="flex flex-col h-full bg-[#f0f2f5]">
                    {/* Header LIST */}
                    <div className="bg-[#008069] p-4 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <UserIcon size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Chats</h3>
                                <p className="text-xs opacity-80">SIGMA Almirante</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="hover:bg-black/10 p-2 rounded-full">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="p-2 bg-white flex items-center gap-2 border-b border-slate-200">
                        <div className="flex-1 bg-[#f0f2f5] rounded-xl px-3 py-1.5 flex items-center gap-2">
                            <Search size={16} className="text-slate-500" />
                            <input 
                                type="text" 
                                placeholder="Buscar contacto..." 
                                className="bg-transparent border-none text-sm w-full focus:ring-0"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Contact Items */}
                    <div className="flex-1 overflow-y-auto bg-white">
                        {/* General Channel */}
                        <div 
                            onClick={() => { setSelectedRecipient(null); setViewMode('CHAT'); }}
                            className="flex items-center gap-3 p-3 hover:bg-[#f5f6f6] cursor-pointer border-b border-slate-100 transition-colors"
                        >
                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700">
                                <MessageCircle size={24} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">Canal General SIGMA</span>
                                    <span className="text-[10px] text-slate-400">Público</span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">Mensajes para todo el equipo</p>
                            </div>
                            {unreadCounts['general'] > 0 && (
                                <div className="bg-[#25d366] text-white text-[10px] font-bold px-2 py-1 rounded-full">
                                    {unreadCounts['general']}
                                </div>
                            )}
                        </div>

                        {/* Private Contacts */}
                        {filteredContacts.map(user => (
                            <div 
                                key={user.username}
                                onClick={() => { setSelectedRecipient(user.username); setViewMode('CHAT'); }}
                                className="flex items-center gap-3 p-3 hover:bg-[#f5f6f6] cursor-pointer border-b border-slate-100 transition-colors"
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${
                                    user.role === 'ADMIN' ? 'bg-indigo-500' : 'bg-emerald-500'
                                }`}>
                                    <UserIcon size={24} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-slate-800">{user.name}</span>
                                        <span className="text-[10px] text-slate-400 uppercase">{user.role}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                                </div>
                                {unreadCounts[user.username] > 0 && (
                                    <div className="bg-[#25d366] text-white text-[10px] font-bold px-2 py-1 rounded-full">
                                        {unreadCounts[user.username]}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VIEW: CHAT WINDOW */}
            {viewMode === 'CHAT' && (
                <div className="flex flex-col h-full bg-[#efeae2]">
                    {/* Header CHAT */}
                    <div className="bg-[#f0f2f5] p-3 flex items-center justify-between border-b border-slate-300">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setViewMode('LIST')} className="p-1 hover:bg-slate-200 rounded-full text-slate-600">
                                <ChevronLeft size={24} />
                            </button>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                                selectedRecipient === null ? 'bg-emerald-600' : 'bg-slate-400'
                            }`}>
                                {selectedRecipient === null ? <MessageCircle size={20} /> : <UserIcon size={20} />}
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-slate-800 leading-none">{getRecipientName()}</h3>
                                <p className="text-[10px] text-slate-500 mt-1">en línea</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><Search size={18} /></button>
                            <button className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><MoreVertical size={18} /></button>
                        </div>
                    </div>

                    {/* Message Area */}
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: '400px' }}>
                        
                        {/* Date Divider */}
                        <div className="flex justify-center my-4">
                            <span className="bg-white/80 backdrop-blur px-3 py-1 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest shadow-sm">Hoy</span>
                        </div>

                        {activeMessages.map((msg, i) => {
                            const isMe = msg.sender_username === currentUser.username;
                            const showName = !isMe && selectedRecipient === null;

                            return (
                                <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl shadow-sm relative group animate-fade-in ${
                                        isMe ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'
                                    }`}>
                                        {showName && (
                                            <p className="text-[10px] font-bold mb-1" style={{ color: `hsl(${msg.sender_username.length * 40}, 70%, 40%)` }}>
                                                {msg.sender_name}
                                            </p>
                                        )}
                                        
                                        {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}

                                        {msg.attachment_url && (
                                            <div className="mt-1">
                                                {msg.attachment_type === 'image' ? (
                                                    <div className="relative rounded-lg overflow-hidden border border-slate-200/50">
                                                        <img src={msg.attachment_url} className="max-h-60 w-full object-cover" alt="img" />
                                                        <a href={msg.attachment_url} download className="absolute bottom-2 right-2 bg-black/50 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Download size={14} />
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <a href={msg.attachment_url} download className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-100 transition-colors">
                                                        <FileText size={16} className="text-red-500" />
                                                        <span className="truncate flex-1">Documento</span>
                                                        <Download size={14} className="text-slate-400" />
                                                    </a>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-end gap-1 mt-1">
                                            <span className="text-[9px] text-slate-500 opacity-70">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </span>
                                            {isMe && (
                                                <span className={msg.is_read ? 'text-[#53bdeb]' : 'text-slate-400'}>
                                                    {msg.is_read ? <CheckCheck size={12} /> : <Check size={12} />}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="bg-[#f0f2f5] p-2 flex items-center gap-2">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => setSelectedFile({
                                        name: file.name,
                                        data: ev.target?.result as string,
                                        type: file.type.startsWith('image/') ? 'image' : 'file'
                                    });
                                    reader.readAsDataURL(file);
                                }
                            }}
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors"
                        >
                            <Paperclip size={24} />
                        </button>
                        
                        <form onSubmit={handleSend} className="flex-1 flex items-center gap-2">
                            <div className="flex-1 relative">
                                {selectedFile && (
                                    <div className="absolute bottom-full left-0 mb-2 w-full bg-white p-2 rounded-xl shadow-lg border border-slate-200 flex items-center justify-between animate-slide-up">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {selectedFile.type === 'image' ? <ImageIcon size={16} className="text-emerald-500" /> : <FileText size={16} className="text-red-500" />}
                                            <span className="text-xs truncate max-w-[150px]">{selectedFile.name}</span>
                                        </div>
                                        <button type="button" onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                                    </div>
                                )}
                                <input 
                                    type="text"
                                    placeholder="Escribe un mensaje..."
                                    className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm focus:ring-0 shadow-sm"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                />
                            </div>
                            <button 
                                type="submit"
                                disabled={!newMessage.trim() && !selectedFile}
                                className={`p-2.5 rounded-full shadow-lg transition-all transform active:scale-95 ${
                                    (!newMessage.trim() && !selectedFile) ? 'bg-slate-300 text-slate-100' : 'bg-[#00a884] text-white hover:bg-[#008f72]'
                                }`}
                            >
                                <Send size={20} />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                @keyframes slide-up { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>
    );
};
