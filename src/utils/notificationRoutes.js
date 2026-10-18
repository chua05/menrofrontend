export const NOTIFICATIONS_UPDATED_EVENT = "menro:notifications-updated";

let latestNotifications = [];

export function getNotificationPath(notification, role) {
  if (!["admin", "staff", "participant"].includes(role)) return null;
  const prefix = `/${role}`;
  const recordId = notification?.relatedRecordId;
  const recordQuery = (name) => recordId
    ? `?${name}=${encodeURIComponent(recordId)}`
    : "";

  if (notification?.relatedRecordType === "seedlingRequest") {
    return role === "participant"
      ? `${prefix}/my-requests${recordQuery("request")}`
      : `${prefix}/requests${recordQuery("request")}`;
  }

  if (notification?.relatedRecordType === "plantingReport") {
    const path = role === "participant"
      ? `${prefix}/my-planting-reports`
      : `${prefix}/planting-reports`;
    if (!recordId) return path;
    const contribution = notification?.relatedSubrecordId
      ? `&contribution=${encodeURIComponent(notification.relatedSubrecordId)}`
      : "";
    return `${path}${recordQuery("report")}${contribution}`;
  }

  if (notification?.relatedRecordType === "monitoring") {
    const observation = notification?.relatedSubrecordId
      ? `${recordId ? "&" : "?"}observation=${encodeURIComponent(notification.relatedSubrecordId)}`
      : "";
    return `${prefix}/survival-monitoring${recordQuery("monitoring")}${observation}`;
  }

  if (notification?.relatedRecordType === "distribution") {
    if (role === "participant") return null;
    return `${prefix}/seedlings?tab=distribution${recordId ? `&distribution=${encodeURIComponent(recordId)}` : ""}`;
  }

  if (notification?.relatedRecordType === "inventory") {
    return role === "participant" ? null : `${prefix}/seedlings${recordQuery("inventory")}`;
  }

  if (notification?.relatedRecordType === "event" || notification?.relatedEventId) {
    const eventId = notification.relatedEventId || recordId;
    return `${prefix}/event-calendar${eventId ? `?event=${encodeURIComponent(eventId)}` : ""}`;
  }

  return null;
}

export function getUnreadCountsByPath(notifications, role) {
  return (notifications || []).reduce((counts, notification) => {
    if (notification?.isRead) return counts;
    const path = getNotificationPath(notification, role);
    const sidebarPath = path?.split("?")[0];
    if (sidebarPath) counts[sidebarPath] = (counts[sidebarPath] || 0) + 1;
    return counts;
  }, {});
}

export function publishNotifications(notifications) {
  latestNotifications = Array.isArray(notifications) ? notifications : [];
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, {
    detail: { notifications: latestNotifications },
  }));
}

export function getPublishedNotifications() {
  return latestNotifications;
}
