"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import ActionButton from "@/components/common/ActionButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HiPencil, HiCamera } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { Button } from "../ui";


import React from "react";

export default function ProfileSection() {
  const [isEditing, setIsEditing] = useState(false);
  const { getCurrentUser, updateUser, uploadFileToS3 } = useAuth();
  const currentUser = getCurrentUser();

  const fetchingRef = useRef(false);
  const currentUserRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    mobileNumber: "",
    bio: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize form data
  useEffect(() => {
    if (currentUser) {
      if (currentUserRef.current?.id === currentUser.id) return;
      currentUserRef.current = currentUser;
      setProfileData({
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        email: currentUser.email || "",
        username: currentUser.username || "",
        mobileNumber: currentUser.mobileNumber || "",
        bio: currentUser.bio || "",
      });
    }
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleUploadButtonClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleProfilePicUpload = useCallback(async () => {
    if (!selectedFile || !currentUser) return;
    setUploadingProfilePic(true);
    try {
      const extension = selectedFile.name.split(".").pop();
      const s3Key = `avatars/${currentUser.id}.${extension}`;
      await uploadFileToS3(selectedFile, s3Key);
      await updateUser(currentUser.id, { avatar: s3Key });
      toast.success("Profile picture updated successfully!");
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      toast.error("Failed to upload profile picture. Please try again.");
    } finally {
      setUploadingProfilePic(false);
    }
  }, [selectedFile, currentUser, uploadFileToS3, updateUser]);

  const handleProfileSubmit = async () => {
    if (!currentUser || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      await updateUser(currentUser.id, {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        mobileNumber: profileData.mobileNumber,
        bio: profileData.bio,
      });
      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch {
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const handleCancel = () => {
    setProfileData({
      firstName: currentUser?.firstName || "",
      lastName: currentUser?.lastName || "",
      email: currentUser?.email || "",
      username: currentUser?.username || "",
      mobileNumber: currentUser?.mobileNumber || "",
      bio: currentUser?.bio || "",
    });
    setIsEditing(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
   <div>
      {/* Header */}
      <div className="flex flex-row-reverse items-start">
        <Button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 rounded-md hover:bg-[var(--accent)] transition-colors ml-auto shadow-none"
          title={isEditing ? "Cancel editing" : "Edit profile"}
        >
          <HiPencil className="w-4 h-4 text-[var(--primary)]" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex gap-8">
        <div className="flex flex-col items-center space-y-4 min-w-[200px]">
          {/* Avatar */}
          <div className="relative group">
            <Avatar className="h-24 w-24 border-2 border-[var(--border)]">
              {(previewUrl || currentUser?.avatar) && (
                <AvatarImage
                  src={previewUrl || currentUser?.avatar || ""}
                  alt={`${profileData.firstName} ${profileData.lastName}`.trim() || "Profile Picture"}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-[var(--primary)] text-[var(--primary-foreground)] font-medium text-lg">
                {`${profileData.firstName?.charAt(0) || ""}${profileData.lastName?.charAt(0) || ""}`.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            {/* Avatar overlay on hover */}
            {isEditing && (
              <div 
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={handleUploadButtonClick}
              >
                <HiCamera className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          {/* Username */}
          <div className="text-center">
            <p className="text-sm text-[var(--muted-foreground)]">
              @{profileData.username || "username"}
            </p>
          </div>

          {/* Upload/Save Button - Only in edit mode */}
          {isEditing && (
            <div className="">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              {selectedFile ? (
                <ActionButton
                  type="button"
                  secondary
                  onClick={handleProfilePicUpload}
                  disabled={uploadingProfilePic}
                  className="text-sm w-full"
                >
                  {uploadingProfilePic ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </div>
                  ) : (
                    "Save Picture"
                  )}
                </ActionButton>
              ) : (
                <ActionButton
                  type="button"
                  secondary
                  onClick={handleUploadButtonClick}
                  disabled={uploadingProfilePic}
                  className="text-sm w-full"
                >
                  Upload Picture
                </ActionButton>
              )}
            </div>
          )}
        </div>

        {/* Right Side - Conditional Content */}
        <div className="flex-1">
          {isEditing ? (
            /* Edit Mode - Form Fields */
            <div className="space-y-4">
              {/* First Name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[var(--foreground)]">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  value={profileData.firstName}
                  onChange={(e) =>
                    setProfileData((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  className="bg-[var(--background)] border-[var(--border)] text-xs"
                  placeholder="Enter your first name"
                />
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[var(--foreground)]">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  value={profileData.lastName}
                  onChange={(e) =>
                    setProfileData((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  className="bg-[var(--background)] border-[var(--border)] text-xs"
                  placeholder="Enter your last name"
                />
              </div>

            

              {/* Email */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[var(--foreground)]">
                  E-mail <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="email"
                  value={profileData.email}
                  onChange={(e) =>
                    setProfileData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="bg-[var(--background)] border-[var(--border)] text-xs"
                  placeholder="Enter your email address"
                />
                <p className="text-xs text-[var(--muted-foreground)]">
                  We'll send a verification email if the address is changed.
                </p>
              </div>

              {/* Mobile Number */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[var(--foreground)]">
                  Mobile Number
                </Label>
                <Input
                  type="tel"
                  value={profileData.mobileNumber}
                  onChange={(e) =>
                    setProfileData((prev) => ({ ...prev, mobileNumber: e.target.value }))
                  }
                  className="bg-[var(--background)] border-[var(--border)] text-xs"
                  placeholder="Enter your mobile number"
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[var(--foreground)]">
                  Bio
                </Label>
                <textarea
                  value={profileData.bio}
                  onChange={(e) =>
                    setProfileData((prev) => ({ ...prev, bio: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded-md resize-none bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  placeholder="Tell us about yourself..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 -mt-2">
                <ActionButton
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="border border-[var(--border)] bg-transparent hover:bg-[var(--muted)]"
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  onClick={handleProfileSubmit}
                  disabled={
                    loading ||
                    !profileData.firstName.trim() ||
                    !profileData.lastName.trim() ||
                    !profileData.email.trim() ||
                    !profileData.username.trim()
                  }
                  primary
                  className="bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)]"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </div>
                  ) : (
                    "Update Information"
                  )}
                </ActionButton>
              </div>
            </div>
          ) : (
            /* Display Mode - User Details as Paragraphs */
            <div className="space-y-2">
              <div>
                <h4 className="text-sm font-medium text-[var(--muted-foreground)]">Full Name</h4>
                <p className="text-[var(--foreground)] text-xs">
                  {`${profileData.firstName} ${profileData.lastName}`.trim() || "Not provided"}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-[var(--muted-foreground)]">Email</h4>
                <p className="text-[var(--foreground)] text-xs">{profileData.email || "Not provided"}</p>
              </div>

              {profileData.mobileNumber && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--muted-foreground)]">Mobile Number</h4>
                  <p className="text-[var(--foreground)] text-xs">{profileData.mobileNumber}</p>
                </div>
              )}

              {profileData.bio && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--muted-foreground)]">Bio</h4>
                  <p className="text-[var(--foreground)] leading-6 text-xs">{profileData.bio}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}