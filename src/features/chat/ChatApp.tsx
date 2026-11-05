import { useEffect, useRef, useState } from 'react';
import { Hash, Send, Users, MessageSquare } from 'lucide-react';
import { CHANNELS, MEMBERS, type ChannelId } from './chatData';
import { useChat, unreadCount } from './chatStore';
import '../shared-apps.css';
export function ChatApp(){
 const chat=useChat(); const [draft,setDraft]=useState(''); const bottom=useRef<HTMLDivElement>(null);
 const messages=chat.messages.filter(m=>m.channel===chat.activeChannel);
 useEffect(()=>{chat.setViewing(true);return()=>useChat.getState().setViewing(false);},[]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'end'});},[chat.activeChannel,messages.length]);
 const channel=CHANNELS.find(c=>c.id===chat.activeChannel)!;
 const send=()=>{chat.send(draft);setDraft('');};
 return <div className="cq-app cq-chat"><aside className="cq-chat-side"><div className="cq-chat-team"><Users size={18}/> CODEQUEST HQ <span>▾</span></div><div className="cq-eyebrow">CHANNELS</div>{CHANNELS.map(c=><button key={c.id} className={chat.activeChannel===c.id?'active':''} onClick={()=>chat.setActive(c.id)}><Hash size={15}/>{c.name}{unreadCount(chat,c.id)>0&&<b>{unreadCount(chat,c.id)}</b>}</button>)}<div className="cq-eyebrow cq-chat-people">TEAM MEMBERS</div>{Object.values(MEMBERS).filter(m=>m.id!=='you').map(m=><div className="cq-chat-member" key={m.id}><span className={`cq-avatar cq-avatar-${m.color}`}>{m.name[0]}</span><span>{m.name}<small>{m.role}</small></span><i/></div>)}</aside><div className="cq-chat-main"><header><MessageSquare size={18}/><div><strong># {channel.name}</strong><small>{channel.topic}</small></div></header><div className="cq-chat-messages">{messages.map(m=>{const person=MEMBERS[m.author];return <div className="cq-chat-message" key={m.id}><span className={`cq-avatar cq-avatar-${person.color}`}>{person.name[0]}</span><div><div className="cq-chat-by"><strong>{person.name}</strong><time>{new Date(m.at).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.text}</p></div></div>;})}<div ref={bottom}/></div><form onSubmit={e=>{e.preventDefault();send();}} className="cq-chat-compose"><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder={`Message #${channel.name}...`} aria-label="Chat message"/><button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send size={18}/></button></form><p className="cq-chat-note">Offline simulated team chat · Mentor replies are scripted</p></div></div>;
}
