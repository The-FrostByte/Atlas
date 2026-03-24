import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Send, Paperclip, Upload, MessageSquare, 
  Reply, Edit2, Clock, User, Check, Lock, AlertCircle, 
  ChevronDown, ChevronRight, X, Wifi, WifiOff, Trash2
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import MentionInput from '../components/MentionInput';
import { api } from '../App';
import { toast } from 'sonner';
import { formatUTCToLocal, formatUTCToLocalDateTime, getRelativeTime, isOverdue } from '../utils/timezone';
import { useTaskRoom, useWebSocket } from '../contexts/WebSocketContext';

export default function TaskDetail({ user }) {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Comment state
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState([]);
  
  // Attachment upload state
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);  // Files selected but not yet uploaded
  const [uploadProgress, setUploadProgress] = useState({});  // Track upload progress per file
  const fileInputRef = useRef(null);
  const commentsEndRef = useRef(null);
  
  // Expanded threads
  const [expandedThreads, setExpandedThreads] = useState({});
  
  // Highlight new items
  const [highlightedComments, setHighlightedComments] = useState(new Set());
  const [highlightedAttachments, setHighlightedAttachments] = useState(new Set());
  
  // WebSocket
  const { isConnected } = useWebSocket();
  const { events, clearEvents } = useTaskRoom(taskId);

  // Handle real-time events
  useEffect(() => {
    if (events.length === 0) return;
    
    events.forEach(event => {
      switch (event.type) {
        case 'comment_created':
        case 'comment_replied': {
          const newComment = event.data.payload;
          setComments(prev => {
            // Avoid duplicates
            if (prev.some(c => c.id === newComment.id)) return prev;
            return [...prev, newComment];
          });
          // Highlight new comment
          setHighlightedComments(prev => new Set([...prev, newComment.id]));
          setTimeout(() => {
            setHighlightedComments(prev => {
              const next = new Set(prev);
              next.delete(newComment.id);
              return next;
            });
          }, 3000);
          break;
        }
        case 'comment_updated': {
          const updatedComment = event.data.payload;
          setComments(prev => prev.map(c => 
            c.id === updatedComment.id ? { ...c, ...updatedComment } : c
          ));
          break;
        }
        case 'attachment_added': {
          const newAttachment = event.data.payload;
          setAttachments(prev => {
            if (prev.some(a => a.id === newAttachment.id)) return prev;
            return [...prev, newAttachment];
          });
          // Highlight new attachment
          setHighlightedAttachments(prev => new Set([...prev, newAttachment.id]));
          setTimeout(() => {
            setHighlightedAttachments(prev => {
              const next = new Set(prev);
              next.delete(newAttachment.id);
              return next;
            });
          }, 3000);
          break;
        }
        case 'attachment_deleted': {
          const deletedId = event.data.attachment_id;
          setAttachments(prev => prev.filter(a => a.id !== deletedId));
          break;
        }
        case 'task_status_updated':
        case 'task_completed': {
          const updatedTask = event.data.payload.task;
          if (updatedTask) {
            setTask(updatedTask);
          }
          break;
        }
        default:
          break;
      }
    });
    
    clearEvents();
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const [taskRes, commentsRes, attachmentsRes, usersRes] = await Promise.all([
        api.get(`/tasks/${taskId}`),
        api.get(`/tasks/${taskId}/comments`),
        api.get(`/tasks/${taskId}/attachments`),
        api.get('/users')
      ]);
      setTask(taskRes.data);
      setComments(commentsRes.data);
      setAttachments(attachmentsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Something went wrong');
      navigate('/tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleMentionSelect = useCallback((user) => {
    setMentionedUsers(prev => {
      if (prev.some(u => u.id === user.id)) return prev;
      return [...prev, user];
    });
  }, []);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      // Get mention IDs from explicitly selected mentions
      const mentionIds = mentionedUsers.map(u => u.id);
      
      await api.post(`/tasks/${taskId}/comments`, {
        content: newComment,
        parent_comment_id: replyingTo,
        mentions: mentionIds
      });
      setNewComment('');
      setReplyingTo(null);
      setMentionedUsers([]);
      toast.success('Comment added');
      // Don't reload - WebSocket will update in real-time
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add comment');
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editContent.trim()) return;
    
    try {
      await api.put(`/comments/${commentId}`, {
        content: editContent,
        mentions: mentionedUsers.map(u => u.id)
      });
      setEditingComment(null);
      setEditContent('');
      setMentionedUsers([]);
      toast.success('Comment updated');
      // Don't reload - WebSocket will update in real-time
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update comment');
    }
  };

  const handleFilesSelected = (files) => {
    // Add files to pending list
    const newFiles = Array.from(files).map(file => ({
      id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      status: 'pending'
    }));
    setPendingFiles(prev => [...prev, ...newFiles]);
  };

  const removePendingFile = (fileId) => {
    setPendingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleUploadAttachments = async () => {
    if (pendingFiles.length === 0) return;
    
    const formData = new FormData();
    pendingFiles.forEach(pf => {
      formData.append('files', pf.file);
    });
    
    try {
      setUploading(true);
      const response = await api.post(`/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const { uploaded, errors, total_uploaded, total_failed } = response.data;
      
      if (total_uploaded > 0) {
        toast.success(`${total_uploaded} file(s) uploaded successfully`);
      }
      
      if (total_failed > 0) {
        errors.forEach(err => {
          toast.error(`${err.filename}: ${err.error}`);
        });
      }
      
      // Clear pending files that were uploaded
      setPendingFiles([]);
      // Don't reload - WebSocket will update in real-time
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const renderMentions = (text) => {
    return text.replace(/@([a-zA-Z0-9_]+)/g, '<span class="text-primary font-medium">@$1</span>');
  };

  const toggleThread = (commentId) => {
    setExpandedThreads(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400';
      default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400';
      case 'medium': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-400';
    }
  };

  const getAttachmentIcon = (type) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'video': return '🎬';
      case 'audio': return '🎵';
      default: return '📄';
    }
  };

  const getAttachmentDownloadUrl = (attachmentId) => {
    return `${process.env.REACT_APP_BACKEND_URL}/api/attachments/${attachmentId}/download`;
  };

  const handleDownloadAttachment = async (attachment) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getAttachmentDownloadUrl(attachment.id), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to download file');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.original_filename || attachment.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to download file');
    }
  };

  const handleViewAttachment = async (attachment) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getAttachmentDownloadUrl(attachment.id), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to load file');
      }
      
      const blob = await response.blob();
      const mimeType = attachment.mime_type || blob.type;
      const url = window.URL.createObjectURL(blob);
      
      // For viewable types, open in modal or new tab
      const viewableTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/mp4'];
      
      if (viewableTypes.some(t => mimeType.includes(t.split('/')[1]) || mimeType === t)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        // Fallback to download for unsupported types
        handleDownloadAttachment(attachment);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to view file');
    }
  };

  const handleDeleteAttachment = async (attachment) => {
    if (!window.confirm(`Are you sure you want to delete "${attachment.original_filename || attachment.filename}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/attachments/${attachment.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete attachment');
      }
      
      // Remove from local state
      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
      toast.success('Attachment deleted successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to delete attachment');
    }
  };

  const canDeleteAttachment = (attachment) => {
    if (!user) return false;
    return user.role === 'admin' || attachment.uploaded_by === user.id;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Build threaded comments structure
  const buildCommentTree = (comments) => {
    const rootComments = comments.filter(c => !c.parent_comment_id);
    const childComments = comments.filter(c => c.parent_comment_id);
    
    const addReplies = (comment) => {
      const replies = childComments.filter(c => c.parent_comment_id === comment.id);
      return {
        ...comment,
        replies: replies.map(addReplies)
      };
    };
    
    return rootComments.map(addReplies);
  };

  const renderComment = (comment, depth = 0) => {
    const isEditing = editingComment === comment.id;
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedThreads[comment.id] !== false;
    const canEdit = user.role === 'admin' || user.id === comment.author_id;
    const isHighlighted = highlightedComments.has(comment.id);
    
    return (
      <motion.div 
        key={comment.id} 
        className={`${depth > 0 ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}
        initial={isHighlighted ? { backgroundColor: 'rgba(34, 197, 94, 0.2)' } : {}}
        animate={{ backgroundColor: 'transparent' }}
        transition={{ duration: 1 }}
      >
        <div className={`py-3 rounded-lg ${isHighlighted ? 'ring-2 ring-green-500 ring-offset-2' : ''}`}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
              {comment.author?.name?.[0] || '?'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{comment.author?.name || 'Unknown'}</span>
                <span className="text-xs text-muted-foreground">
                  {formatUTCToLocal(comment.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                {comment.is_edited && (
                  <span className="text-xs text-muted-foreground italic">(edited)</span>
                )}
                {isHighlighted && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">New</Badge>
                )}
              </div>
              
              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    data-testid="edit-comment-input"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleEditComment(comment.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingComment(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p 
                  className="text-sm text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: renderMentions(comment.content) }}
                />
              )}
              
              {/* Comment attachments */}
              {comment.attachments?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachments
                    .filter(a => comment.attachments.includes(a.id))
                    .map(att => (
                      <div key={att.id} className="flex items-center gap-1 px-2 py-1 bg-secondary rounded text-xs group">
                        <button
                          onClick={() => handleDownloadAttachment(att)}
                          className="flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          {getAttachmentIcon(att.type)}
                          {att.original_filename || att.filename}
                        </button>
                        {canDeleteAttachment(att) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAttachment(att);
                            }}
                            className="ml-1 text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete attachment"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
              
              {/* Actions */}
              {!isEditing && (
                <div className="flex items-center gap-3 mt-2">
                  <button 
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    onClick={() => {
                      setReplyingTo(comment.id);
                      setNewComment(`@${comment.author?.name} `);
                    }}
                  >
                    <Reply className="h-3 w-3" />
                    Reply
                  </button>
                  {canEdit && (
                    <button 
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      onClick={() => {
                        setEditingComment(comment.id);
                        setEditContent(comment.content);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                  {hasReplies && (
                    <button 
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      onClick={() => toggleThread(comment.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Render replies */}
        {hasReplies && isExpanded && (
          <div className="mt-1">
            {comment.replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </motion.div>
    );
  };

  if (loading) {
    return (
    
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
     
    );
  }

  if (!task) {
    return (
     
        <div className="text-center py-12">
          <p className="text-muted-foreground">Task not found</p>
          <Button variant="link" onClick={() => navigate('/tasks')}>
            Go back to tasks
          </Button>
        </div>
     
    );
  }

  const assignedUser = users.find(u => u.id === task.assigned_to);
  const assignedByUser = users.find(u => u.id === task.assigned_by);
  const commentTree = buildCommentTree(comments);
  const taskAttachments = attachments.filter(a => !a.comment_id);

  return (
  
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tasks')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-bold">{task.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
              <Badge className={getStatusColor(task.status)}>{task.status.replace('_', ' ')}</Badge>
              {task.status === 'completed' && (
                <Badge variant="outline" className="border-green-500/50 text-green-600">
                  <Lock className="h-3 w-3 mr-1" />
                  Read-only
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Task Details */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
              <p>{task.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Responsible Owner</h3>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {assignedUser?.name || 'Unknown'}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Created By</h3>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {assignedByUser?.name || 'Unknown'}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Due Date & Time</h3>
                <div className={`flex items-center gap-2 ${isOverdue(task.due_date) && task.status !== 'completed' ? 'text-red-600' : ''}`}>
                  <Clock className="h-4 w-4" />
                  {formatUTCToLocalDateTime(task.due_date)}
                  {task.status !== 'completed' && (
                    <span className="text-xs">({getRelativeTime(task.due_date)})</span>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Created</h3>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatUTCToLocal(task.created_at, { dateStyle: 'medium' })}
                </div>
              </div>
            </div>

            {/* Resolution (if completed) */}
            {task.status === 'completed' && task.resolution && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <h3 className="font-medium text-green-700">Resolution</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{task.resolution.text}</p>
                <p className="text-xs text-muted-foreground">
                  Completed {formatUTCToLocal(task.resolution.completed_at, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Attachments */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments ({taskAttachments.length})
            </h2>
            {task.status !== 'completed' && (
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" disabled={uploading} asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Select Files
                  </span>
                </Button>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files?.length > 0) {
                      handleFilesSelected(e.target.files);
                      e.target.value = ''; // Reset input
                    }
                  }}
                  data-testid="task-attachment-input"
                />
              </label>
            )}
          </div>
          
          {/* Pending Files Queue */}
          {pendingFiles.length > 0 && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Files to Upload ({pendingFiles.length})
                </h3>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setPendingFiles([])}
                    className="text-blue-600 hover:text-blue-800"
                    data-testid="clear-pending-files"
                  >
                    Clear All
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleUploadAttachments}
                    disabled={uploading}
                    data-testid="upload-pending-files"
                  >
                    {uploading ? 'Uploading...' : `Upload ${pendingFiles.length} File(s)`}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {pendingFiles.map(pf => (
                  <div 
                    key={pf.id}
                    className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-md"
                    data-testid={`pending-file-${pf.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">📄</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{pf.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(pf.size)}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removePendingFile(pf.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-100"
                      data-testid={`remove-pending-${pf.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {taskAttachments.length === 0 && pendingFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No attachments yet</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {taskAttachments.map(att => (
                <motion.div
                  key={att.id}
                  initial={highlightedAttachments.has(att.id) ? { scale: 1.02, backgroundColor: 'rgba(34, 197, 94, 0.2)' } : {}}
                  animate={{ scale: 1, backgroundColor: 'transparent' }}
                  transition={{ duration: 0.5 }}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    highlightedAttachments.has(att.id) ? 'bg-green-100 dark:bg-green-900/20 ring-2 ring-green-500' : 'bg-secondary/50'
                  }`}
                  data-testid={`attachment-${att.id}`}
                >
                  <span className="text-2xl">{getAttachmentIcon(att.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{att.original_filename || att.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(att.size)} • {formatUTCToLocal(att.created_at, { dateStyle: 'short' })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {['image', 'video', 'audio'].includes(att.type) || att.mime_type === 'application/pdf' ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewAttachment(att)}
                        data-testid={`view-attachment-${att.id}`}
                      >
                        View
                      </Button>
                    ) : null}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDownloadAttachment(att)}
                      data-testid={`download-attachment-${att.id}`}
                    >
                      Download
                    </Button>
                    {canDeleteAttachment(att) && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteAttachment(att)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        data-testid={`delete-attachment-${att.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>

        {/* Comments */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Comments ({comments.length})
            </h2>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Badge variant="outline" className="text-green-600 border-green-500/50">
                  <Wifi className="h-3 w-3 mr-1" />
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </Badge>
              )}
            </div>
          </div>
          
          {/* Comment input */}
          <div className="mb-6">
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                <Reply className="h-4 w-4" />
                Replying to comment
                <button 
                  className="text-primary hover:underline"
                  onClick={() => {
                    setReplyingTo(null);
                    setNewComment('');
                    setMentionedUsers([]);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <MentionInput
                placeholder="Add a comment... Type @ to mention users"
                value={newComment}
                onChange={setNewComment}
                onMentionSelect={handleMentionSelect}
                rows={2}
                className="flex-1"
                data-testid="new-comment-input"
              />
              <Button onClick={handleSubmitComment} disabled={!newComment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {mentionedUsers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">Mentioning:</span>
                {mentionedUsers.map(u => (
                  <Badge key={u.id} variant="secondary" className="text-xs">
                    @{u.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          
          {/* Comments list */}
          {commentTree.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first to comment!</p>
          ) : (
            <div className="divide-y" ref={commentsEndRef}>
              {commentTree.map(comment => renderComment(comment))}
            </div>
          )}
        </Card>
      </div>
   
  );
}
