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
import { canUploadAttachment, canDeleteAttachment, canViewTask } from '../utils/permissions';

export default function TaskDetail({ user }) {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileInputRef = useRef(null);
  const commentsEndRef = useRef(null);

  const [expandedThreads, setExpandedThreads] = useState({});
  const [highlightedComments, setHighlightedComments] = useState(new Set());
  const [highlightedAttachments, setHighlightedAttachments] = useState(new Set());

  const { isConnected } = useWebSocket();
  const { events, clearEvents } = useTaskRoom(taskId);

  // ── WebSocket events ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!events.length) return;
    events.forEach(event => {
      switch (event.type) {
        case 'comment_created':
        case 'comment_replied': {
          const nc = event.data.payload;
          setComments(prev => prev.some(c => c.id === nc.id) ? prev : [...prev, nc]);
          setHighlightedComments(prev => new Set([...prev, nc.id]));
          setTimeout(() => setHighlightedComments(prev => { const n = new Set(prev); n.delete(nc.id); return n; }), 3000);
          break;
        }
        case 'comment_updated': {
          const uc = event.data.payload;
          setComments(prev => prev.map(c => c.id === uc.id ? { ...c, ...uc } : c));
          break;
        }
        case 'attachment_added': {
          const na = event.data.payload;
          setAttachments(prev => prev.some(a => a.id === na.id) ? prev : [...prev, na]);
          setHighlightedAttachments(prev => new Set([...prev, na.id]));
          setTimeout(() => setHighlightedAttachments(prev => { const n = new Set(prev); n.delete(na.id); return n; }), 3000);
          break;
        }
        case 'attachment_deleted':
          setAttachments(prev => prev.filter(a => a.id !== event.data.attachment_id));
          break;
        case 'task_status_updated':
        case 'task_completed':
          if (event.data.payload?.task) setTask(event.data.payload.task);
          break;
        default: break;
      }
    });
    clearEvents();
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (error.response?.status === 403) {
        toast.error('Forbidden: You do not have access to this task');
      } else {
        toast.error(error.response?.data?.message || 'Something went wrong');
      }
      navigate('/tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleMentionSelect = useCallback((u) => {
    setMentionedUsers(prev => prev.some(x => x.id === u.id) ? prev : [...prev, u]);
  }, []);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.post(`/tasks/${taskId}/comments`, {
        content: newComment,
        parent_comment_id: replyingTo,
        mentions: mentionedUsers.map(u => u.id)
      });
      setNewComment('');
      setReplyingTo(null);
      setMentionedUsers([]);
      toast.success('Comment added');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editContent.trim()) return;
    try {
      await api.put(`/comments/${commentId}`, { content: editContent, mentions: mentionedUsers.map(u => u.id) });
      setEditingComment(null);
      setEditContent('');
      setMentionedUsers([]);
      toast.success('Comment updated');
    } catch (error) {
      if (error.response?.status === 403) toast.error('Forbidden: Only the author or admin can edit this comment');
      else toast.error(error.response?.data?.message || 'Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.delete(`/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Comment deleted');
    } catch (error) {
      if (error.response?.status === 403) toast.error('Forbidden: Only the author or admin can delete this comment');
      else toast.error(error.response?.data?.message || 'Failed to delete comment');
    }
  };

  const handleFilesSelected = (files) => {
    const newFiles = Array.from(files).map(file => ({
      id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file, name: file.name, size: file.size, status: 'pending'
    }));
    setPendingFiles(prev => [...prev, ...newFiles]);
  };

  const handleUploadAttachments = async () => {
    if (!pendingFiles.length) return;
    const fd = new FormData();
    pendingFiles.forEach(pf => fd.append('files', pf.file));
    try {
      setUploading(true);
      const { data } = await api.post(`/tasks/${taskId}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.total_uploaded > 0) toast.success(`${data.total_uploaded} file(s) uploaded`);
      if (data.total_failed > 0) data.errors.forEach(e => toast.error(`${e.filename}: ${e.error}`));
      setPendingFiles([]);
    } catch (error) {
      if (error.response?.status === 403) toast.error('Forbidden: Only admins can upload to completed tasks');
      else toast.error(error.response?.data?.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/attachments/${attachment.id}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to download file');
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
      toast.error('Failed to download file');
    }
  };

  const handleViewAttachment = async (attachment) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/attachments/${attachment.id}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to load file');
      const blob = await response.blob();
      const mimeType = attachment.mime_type || blob.type;
      const url = window.URL.createObjectURL(blob);
      const viewable = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm'];
      if (viewable.some(t => mimeType.startsWith(t.split('/')[0]) || mimeType === t)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        handleDownloadAttachment(attachment);
      }
    } catch { toast.error('Failed to view file'); }
  };

  const handleDeleteAttachment = async (attachment) => {
    if (!window.confirm(`Delete "${attachment.original_filename || attachment.filename}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/attachments/${attachment.id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 403) { toast.error('Forbidden: Only the uploader or admin can delete this file'); return; }
        throw new Error(err.message || 'Failed to delete');
      }
      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
      toast.success('Attachment deleted');
    } catch (error) {
      toast.error(error.message || 'Failed to delete attachment');
    }
  };

  const renderMentions = (text) =>
    text.replace(/@([a-zA-Z0-9_]+)/g, '<span class="text-primary font-medium">@$1</span>');

  const toggleThread = (commentId) =>
    setExpandedThreads(prev => ({ ...prev, [commentId]: !prev[commentId] }));

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getAttachmentIcon = (type) =>
    type === 'image' ? '🖼️' : type === 'video' ? '🎬' : type === 'audio' ? '🎵' : '📄';

  const buildCommentTree = (comments) => {
    const roots = comments.filter(c => !c.parent_comment_id);
    const children = comments.filter(c => c.parent_comment_id);
    const addReplies = (c) => ({
      ...c,
      replies: children.filter(r => r.parent_comment_id === c.id).map(addReplies)
    });
    return roots.map(addReplies);
  };

  const renderComment = (comment, depth = 0) => {
    const isEditing = editingComment === comment.id;
    const hasReplies = comment.replies?.length > 0;
    const isExpanded = expandedThreads[comment.id] !== false;
    // Author or admin can edit/delete
    const canEditCmt = user.role === 'admin' || user.id === comment.author_id;
    const canDeleteCmt = user.role === 'admin' || user.id === comment.author_id;
    const isHighlighted = highlightedComments.has(comment.id);

    return (
      <motion.div key={comment.id} className={`${depth > 0 ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}
        initial={isHighlighted ? { backgroundColor: 'rgba(34, 197, 94, 0.2)' } : {}}
        animate={{ backgroundColor: 'transparent' }} transition={{ duration: 1 }}>
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
                {comment.is_edited && <span className="text-xs text-muted-foreground italic">(edited)</span>}
                {isHighlighted && <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">New</Badge>}
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleEditComment(comment.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingComment(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: renderMentions(comment.content) }} />
              )}
              {!isEditing && (
                <div className="flex items-center gap-3 mt-2">
                  <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    onClick={() => { setReplyingTo(comment.id); setNewComment(`@${comment.author?.name} `); }}>
                    <Reply className="h-3 w-3" />Reply
                  </button>
                  {canEditCmt && (
                    <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      onClick={() => { setEditingComment(comment.id); setEditContent(comment.content); }}>
                      <Edit2 className="h-3 w-3" />Edit
                    </button>
                  )}
                  {canDeleteCmt && (
                    <button className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                      onClick={() => handleDeleteComment(comment.id)}>
                      <Trash2 className="h-3 w-3" />Delete
                    </button>
                  )}
                  {hasReplies && (
                    <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      onClick={() => toggleThread(comment.id)}>
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {hasReplies && isExpanded && (
          <div className="mt-1">{comment.replies.map(r => renderComment(r, depth + 1))}</div>
        )}
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Task not found</p>
        <Button variant="link" onClick={() => navigate('/tasks')}>Go back to tasks</Button>
      </div>
    );
  }

  const assignedUser = users.find(u => u.id === task.assigned_to);
  const assignedByUser = users.find(u => u.id === task.assigned_by);
  const commentTree = buildCommentTree(comments);
  const taskAttachments = attachments.filter(a => !a.comment_id);

  // ── RBAC for this page ──────────────────────────────────────────────────────
  // canUploadAttachment: active task = any viewer; completed = admin only
  const uploadAllowed = canUploadAttachment(user, task);

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
      case 'critical': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-400';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tasks')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
            <Badge className={getStatusColor(task.status)}>{task.status.replace('_', ' ')}</Badge>
            {task.status === 'completed' && (
              <Badge variant="outline" className="border-green-500/50 text-green-600">
                <Lock className="h-3 w-3 mr-1" />Read-only
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Task Details */}
      <Card className="p-6">
        <div className="space-y-4">
          {task.description && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
              <p>{task.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Responsible Owner</h3>
              <div className="flex items-center gap-2"><User className="h-4 w-4" />{assignedUser?.name || 'Unknown'}</div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Created By</h3>
              <div className="flex items-center gap-2"><User className="h-4 w-4" />{assignedByUser?.name || 'Unknown'}</div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Due Date & Time</h3>
              <div className={`flex items-center gap-2 ${isOverdue(task.due_date) && task.status !== 'completed' ? 'text-red-600' : ''}`}>
                <Clock className="h-4 w-4" />
                {formatUTCToLocalDateTime(task.due_date)}
                {task.status !== 'completed' && <span className="text-xs">({getRelativeTime(task.due_date)})</span>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Created</h3>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />{formatUTCToLocal(task.created_at, { dateStyle: 'medium' })}
              </div>
            </div>
          </div>
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
          {/* Upload button: shown only when allowed per RBAC */}
          {uploadAllowed && (
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" disabled={uploading} asChild>
                <span><Upload className="h-4 w-4 mr-2" />Select Files</span>
              </Button>
              <input type="file" multiple className="hidden" ref={fileInputRef}
                onChange={e => { if (e.target.files?.length > 0) { handleFilesSelected(e.target.files); e.target.value = ''; } }} />
            </label>
          )}
          {!uploadAllowed && task.status === 'completed' && user.role !== 'admin' && (
            <span className="text-xs text-muted-foreground italic">Uploads locked — task completed</span>
          )}
        </div>

        {/* Pending files queue */}
        {pendingFiles.length > 0 && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Files to Upload ({pendingFiles.length})</h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPendingFiles([])} className="text-blue-600 hover:text-blue-800">Clear All</Button>
                <Button size="sm" onClick={handleUploadAttachments} disabled={uploading}>
                  {uploading ? 'Uploading...' : `Upload ${pendingFiles.length} File(s)`}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {pendingFiles.map(pf => (
                <div key={pf.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-md">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">📄</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{pf.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(pf.size)}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setPendingFiles(prev => prev.filter(f => f.id !== pf.id))}
                    className="text-red-500 hover:text-red-700 hover:bg-red-100">
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
              <motion.div key={att.id}
                initial={highlightedAttachments.has(att.id) ? { scale: 1.02, backgroundColor: 'rgba(34, 197, 94, 0.2)' } : {}}
                animate={{ scale: 1, backgroundColor: 'transparent' }} transition={{ duration: 0.5 }}
                className={`flex items-center gap-3 p-3 rounded-lg ${highlightedAttachments.has(att.id) ? 'bg-green-100 dark:bg-green-900/20 ring-2 ring-green-500' : 'bg-secondary/50'}`}>
                <span className="text-2xl">{getAttachmentIcon(att.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{att.original_filename || att.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(att.size)} · {formatUTCToLocal(att.created_at, { dateStyle: 'short' })}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(['image', 'video', 'audio'].includes(att.type) || att.mime_type === 'application/pdf') && (
                    <Button variant="outline" size="sm" onClick={() => handleViewAttachment(att)}>View</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleDownloadAttachment(att)}>Download</Button>
                  {/* Delete: uploader or admin — checked by canDeleteAttachment */}
                  {canDeleteAttachment(user, att) && (
                    <Button variant="outline" size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteAttachment(att)}>
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
            {isConnected
              ? <Badge variant="outline" className="text-green-600 border-green-500/50"><Wifi className="h-3 w-3 mr-1" />Live</Badge>
              : <Badge variant="outline" className="text-muted-foreground"><WifiOff className="h-3 w-3 mr-1" />Offline</Badge>}
          </div>
        </div>

        {/* Comment input */}
        <div className="mb-6">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <Reply className="h-4 w-4" />Replying to comment
              <button className="text-primary hover:underline" onClick={() => { setReplyingTo(null); setNewComment(''); setMentionedUsers([]); }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <MentionInput placeholder="Add a comment… Type @ to mention users"
              value={newComment} onChange={setNewComment}
              onMentionSelect={handleMentionSelect} rows={2} className="flex-1" />
            <Button onClick={handleSubmitComment} disabled={!newComment.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {mentionedUsers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Mentioning:</span>
              {mentionedUsers.map(u => <Badge key={u.id} variant="secondary" className="text-xs">@{u.name}</Badge>)}
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