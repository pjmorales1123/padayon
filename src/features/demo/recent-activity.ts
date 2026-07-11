// Builds learner-summary activity rows from the saved library state.
export interface LibraryMaterialActivitySource {
  id?: string | null;
  type?: string | null;
  created_at?: string | null;
}

export interface LibraryTopicActivitySource {
  id?: string | null;
  title?: string | null;
  subject_name?: string | null;
  subcategory?: string | null;
  mastery_level?: number | null;
  materials?: LibraryMaterialActivitySource[] | null;
}

export interface LibrarySubjectActivitySource {
  name?: string | null;
  topics?: LibraryTopicActivitySource[] | null;
}

export interface RecentActivity {
  id: string;
  message: string;
  topicTitle?: string;
}

function materialTimestamp(material: LibraryMaterialActivitySource) {
  return material.created_at ? new Date(material.created_at).getTime() : 0;
}

export function getRecentActivity(subjects: LibrarySubjectActivitySource[] | null | undefined): RecentActivity | null {
  const imageActivities =
    subjects
      ?.flatMap((subject) =>
        (subject.topics || []).flatMap((topic) =>
          (topic.materials || [])
            .filter((material) => material.type === "image_notes")
            .map((material) => ({
              id: material.id || `${topic.id || topic.title || subject.name || "topic"}-image`,
              message: "Placed one picture in your library and saved the contents.",
              topicTitle: topic.title || undefined,
              sortTime: materialTimestamp(material),
            })),
        ),
      )
      .sort((a, b) => b.sortTime - a.sortTime) || [];

  const latest = imageActivities[0];
  if (!latest) return null;

  return {
    id: latest.id,
    message: latest.message,
    topicTitle: latest.topicTitle,
  };
}
