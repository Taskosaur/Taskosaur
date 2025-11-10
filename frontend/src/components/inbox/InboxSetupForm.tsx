import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { HiEnvelope, HiCog } from "react-icons/hi2";

// Form validation schema using Zod
const inboxSetupSchema = z.object({
  name: z.string().min(1, "Inbox name is required").max(100),
  description: z.string().optional(),
  emailAddress: z.string().email("Valid email address is required").optional().or(z.literal("")),
  emailSignature: z.string().optional(),
  autoReplyEnabled: z.boolean().optional(),
  autoReplyTemplate: z.string().optional(), // ✅ MUST BE PRESENT
  autoCreateTask: z.boolean().optional(),
  defaultTaskType: z.enum(["TASK", "BUG", "EPIC", "STORY", "SUBTASK"]).optional(),
  defaultPriority: z.enum(["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"]).optional(),
  defaultStatusId: z.string().min(1, "Default status is required"),
});

export type InboxSetupFormData = z.infer<typeof inboxSetupSchema>;

interface InboxSetupFormProps {
  onSubmit: (data: InboxSetupFormData) => Promise<void>;
  onCancel: () => void;
  availableStatuses: Array<{ id: string; name: string; color?: string }>;
  defaultValues?: Partial<InboxSetupFormData>;
  isLoading?: boolean;
}

export default function InboxSetupForm({
  onSubmit,
  onCancel,
  availableStatuses,
  defaultValues,
  isLoading = false,
}: InboxSetupFormProps) {
  const form = useForm<InboxSetupFormData>({
    resolver: zodResolver(inboxSetupSchema),
    defaultValues: {
      name: "Project Inbox",
      autoCreateTask: true,
      autoReplyEnabled: false,
      defaultTaskType: "TASK",
      defaultPriority: "MEDIUM",
      defaultStatusId: availableStatuses[0]?.id || "",
      ...defaultValues,
    },
  });

  const {
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;
  const autoReplyEnabled = watch("autoReplyEnabled");

  const handleFormSubmit = async (data: InboxSetupFormData) => {
    try {
      await onSubmit(data);
      toast.success("Inbox setup completed successfully");
    } catch (error) {
      toast.error("Failed to setup inbox");
      console.error("Inbox setup error:", error);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <HiEnvelope className="w-5 h-5" />
          <span>Set Up Email Integration</span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inbox Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Support Inbox" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormDescription>A descriptive name for your email inbox</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Customer support email integration"
                        rows={2}
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>Optional description of this inbox's purpose</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="support@company.com"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      The email address for this inbox (can be set up later)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Task Creation Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Task Creation Settings</h3>

              <FormField
                control={form.control}
                name="autoCreateTask"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Auto-create Tasks</FormLabel>
                      <FormDescription>
                        Automatically convert incoming emails to tasks
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="defaultTaskType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Task Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select task type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="TASK">Task</SelectItem>
                          <SelectItem value="BUG">Bug</SelectItem>
                          <SelectItem value="EPIC">Epic</SelectItem>
                          <SelectItem value="STORY">Story</SelectItem>
                          <SelectItem value="SUBTASK">Subtask</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultPriority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Priority</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="HIGHEST">Highest</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="defaultStatusId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Status *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select default status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            <div className="flex items-center space-x-2">
                              {status.color && (
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: status.color }}
                                />
                              )}
                              <span>{status.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Status assigned to new tasks created from emails
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Auto-Reply Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Auto-Reply Settings</h3>

              <FormField
                control={form.control}
                name="autoReplyEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Auto-Reply</FormLabel>
                      <FormDescription>Send automatic replies to incoming emails</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {autoReplyEnabled && (
                <FormField
                  control={form.control}
                  name="autoReplyTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Auto-Reply Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Thank you for contacting us. We'll respond within 24 hours."
                          rows={4}
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormDescription>Message sent automatically to email senders</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Email Signature */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Email Signature</h3>

              <FormField
                control={form.control}
                name="emailSignature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Signature</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="--&#10;Best regards,&#10;Support Team"
                        rows={3}
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>Signature added to all outgoing email replies</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Form Actions */}
            <div className="flex space-x-4 pt-6 border-t">
              <Button type="submit" disabled={isSubmitting || isLoading} className="flex-1">
                {isSubmitting ? (
                  <>
                    <HiCog className="w-4 h-4 mr-2 animate-spin" />
                    Creating Inbox...
                  </>
                ) : (
                  "Create Inbox"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting || isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
