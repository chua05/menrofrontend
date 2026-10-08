export const NOTIFICATIONS_UPDATED_EVENT = "menro:notifications-updated";

let latestNotifications = [];

export function getNotificationPath(notification, role) {
  const prefix = `/${role}`;

  if (notification?.relatedRecordType === "seedlingRequest") {
    return role === "participant" ? `${prefix}/my-requests` : `${prefix}/requests`;
  }

  if (notification?.relatedRecordType === "plantingReport") {
    return role === "participant"
      ? `${prefix}/my-planting-reports`
      : `${prefix}/planting-reports`;
  }

  if (notification?.relatedRecordType === "inventory") {
    return role === "participant" ? null : `${prefix}/seedlings`;
  }

  if (notification?.relatedRecordType === "event" || notification?.relatedEventId) {
    return `${prefix}/event-calendar`;
  }

  return null;
}

export function getUnreadCountsByPath(notifications, role) {
  return (notifications || []).reduce((counts, notification) => {
    if (notification?.isRead) return counts;
    const path = getNotificationPath(notification, role);
    if (path) counts[path] = (counts[path] || 0) + 1;
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
