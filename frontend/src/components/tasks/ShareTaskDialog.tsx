import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { shareApi, ShareResponse } from '@/utils/api/shareApi';
import { HiClipboard, HiTrash, HiCheck, HiGlobeAlt } from 'react-icons/hi2';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HiLink } from 'react-icons/hi';

interface ShareTaskDialogProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareTaskDialog({ taskId, isOpen, onClose }: ShareTaskDialogProps) {
  const [expiryDays, setExpiryDays] = useState('7');
  const [shares, setShares] = useState<ShareResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadShares();
    }
  }, [isOpen, taskId]);

  const loadShares = async () => {
    setLoading(true);
    try {
      const data = await shareApi.getSharesForTask(taskId);
      setShares(data);
    } catch (error) {
      toast.error('Failed to load share links');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async () => {
    setCreating(true);
    try {
      const newShare = await shareApi.createShare({
        taskId,
        expiresInDays: parseInt(expiryDays),
      });
      setShares([newShare, ...shares]);
      toast.success('Public link created');
      
      // Auto copy
      copyToClipboard(newShare.shareUrl, newShare.id);
    } catch (error) {
      toast.error('Failed to create share link');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      await shareApi.revokeShare(shareId);
      setShares(shares.filter(s => s.id !== shareId));
      toast.success('Link revoked');
    } catch (error) {
      toast.error('Failed to revoke link');
    }
  };

  const copyToClipboard = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share to Web</DialogTitle>
          <DialogDescription>
            Publish this task to the web. Anyone with the link can view it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 min-w-0">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="expiry">Link expires in</Label>
              <div className="flex gap-2">
                <Select value={expiryDays} onValueChange={setExpiryDays}>
                  <SelectTrigger id="expiry" className="w-[180px]">
                    <SelectValue placeholder="Select expiry" />
                  </SelectTrigger>
                  <SelectContent className='bg-gray-50/85 '>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleCreateShare} 
                  disabled={creating}
                  className="flex-1"
                >
                  {creating ? 'Creating...' : 'Create Public Link'}
                </Button>
              </div>
            </div>
          </div>

          {shares.length > 0 && (
            <div className="space-y-3">
              <Label>Active Links ({shares.length})</Label>
              <ScrollArea className="h-[200px] w-full rounded-md border p-3" orientation='both'>
                <div className="space-y-3">
                  {shares.map((share) => (
                    <div 
                      key={share.id} 
                      className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm min-w-0"
                    >
                      <div className="flex items-center justify-between min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={isExpired(share.expiresAt) ? "destructive" : "secondary"}>
                            {isExpired(share.expiresAt) ? 'Expired' : 'Active'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Expires {formatDate(share.expiresAt)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRevokeShare(share.id)}
                          title="Revoke link"
                        >
                          <HiTrash className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2 rounded-md bg-muted p-2">
                        <HiLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0"> 
                          <p className="truncate text-xs font-mono text-muted-foreground w-full">
                            {share.shareUrl}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => copyToClipboard(share.shareUrl, share.id)}
                        >
                          {copiedId === share.id ? (
                            <HiCheck className="h-4 w-4 text-green-500" />
                          ) : (
                            <HiClipboard className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
