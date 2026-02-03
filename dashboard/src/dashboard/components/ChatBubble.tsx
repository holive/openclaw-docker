import './ChatBubble.css';

interface ChatAvatarProps {
  type: 'user' | 'assistant';
  name?: string;
}

export function ChatAvatar({ type, name }: ChatAvatarProps) {
  const initial = name ? name.charAt(0).toUpperCase() : type === 'user' ? 'U' : 'A';

  return (
    <div className={`chat-avatar ${type}`}>
      {initial}
    </div>
  );
}

interface ChatBubbleProps {
  children: React.ReactNode;
  streaming?: boolean;
}

export function ChatBubble({ children, streaming = false }: ChatBubbleProps) {
  return (
    <div className={`chat-bubble ${streaming ? 'streaming' : ''}`}>
      <div className="chat-bubble-content">
        {children}
      </div>
    </div>
  );
}

interface ChatGroupProps {
  type: 'user' | 'assistant';
  avatarName?: string;
  timestamp?: Date;
  children: React.ReactNode;
}

export function ChatGroup({ type, avatarName, timestamp, children }: ChatGroupProps) {
  return (
    <div className={`chat-group ${type}`}>
      <ChatAvatar type={type} name={avatarName} />
      <div className="chat-messages">
        {children}
        {timestamp && (
          <span className="chat-timestamp">
            {timestamp.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    </div>
  );
}

export function ChatTyping() {
  return (
    <div className="chat-bubble">
      <div className="chat-typing">
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </div>
    </div>
  );
}
