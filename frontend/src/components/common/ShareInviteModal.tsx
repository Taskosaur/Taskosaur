import { ReactNode, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invitationApi } from "@/utils/api/invitationsApi";
import { Share2, Copy, Check, Loader2 } from "lucide-react";

interface ShareInviteModalProps {
  entityType: "organization" | "workspace" | "project";
  entityId: string;
  entityName: string;
  redirectPath: string;
  trigger?: ReactNode;
}

type ModalState = "idle" | "loading" | "success" | "error";

export function ShareInviteModal({
  entityType,
  entityId,
  entityName,
  redirectPath,
  trigger,
}: ShareInviteModalProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ModalState>("idle");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [phone, setPhone] = useState("");

  function reset() {
    setState("idle");
    setEmail("");
    setLink("");
    setCopied(false);
    setErrorMsg("");
    setShowWhatsApp(false);
    setPhone("");
  }

  async function handleCreateLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    setErrorMsg("");
    try {
      const response = await invitationApi.createInvitation({
        inviteeEmail: email.trim(),
        [`${entityType}Id`]: entityId,
        role: "VIEWER",
      } as any);
      const generatedLink = `${window.location.origin}/invite?token=${response.token}&redirect=${encodeURIComponent(redirectPath)}`;
      setLink(generatedLink);
      setState("success");
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? "Failed to create invite link. Please try again.");
      setState("error");
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (!digits) return;
    const message = `Hi! I'd like to share access to ${entityName} with you. Click this link to view it: ${link}`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {entityName}</DialogTitle>
        </DialogHeader>

        {(state === "idle" || state === "error") && (
          <form onSubmit={handleCreateLink} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="share-email">Invite someone as a viewer</Label>
              <Input
                id="share-email"
                type="email"
                placeholder="their@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            {state === "error" && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
            <Button type="submit" className="w-full">
              Create Invite Link
            </Button>
          </form>
        )}

        {state === "loading" && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {state === "success" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Invite link</Label>
              <div className="flex gap-2">
                <Input value={link} readOnly className="text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                An invitation email has been sent to {email}.
              </p>
            </div>

            <div className="border-t pt-4 space-y-3">
              {!showWhatsApp ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowWhatsApp(true)}
                >
                  Share via WhatsApp
                </Button>
              ) : (
                <form onSubmit={handleWhatsApp} className="space-y-2">
                  <Label htmlFor="share-phone">WhatsApp number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="share-phone"
                      type="tel"
                      placeholder="+27 82 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      autoFocus
                    />
                    <Button type="submit" className="shrink-0">Send</Button>
                  </div>
                </form>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={reset}
            >
              Invite someone else
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
