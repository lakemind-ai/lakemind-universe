import { useEffect, useState } from "react";
import { Dialog } from "@/components/reusable/dialog";
import {
  Globe,
  Plus,
  Boxes,
  Table2,
  BarChart3,
  Tags,
  X,
  Check,
  Pencil,
  Trash2,
  Layers,
} from "lucide-react";
import RealmService, { RealmSummary, AvailableEntity } from "@/services/realmservice";
import { PageHeader } from "@/components/reusable/page-header";
import { Loader } from "@/components/reusable/loader";
import { toast } from "react-toastify";

export function RealmsPage() {
  const [realms, setRealms] = useState<RealmSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogForm, setDialogForm] = useState({ id: 0, name: "", description: "" });
  const [selectedEntityIds, setSelectedEntityIds] = useState<number[]>([]);
  const [availableEntities, setAvailableEntities] = useState<AvailableEntity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [entitySearch, setEntitySearch] = useState("");

  useEffect(() => {
    loadRealms();
  }, []);

  const loadRealms = async () => {
    setLoading(true);
    try {
      const data = await RealmService.listRealms();
      setRealms(data);
    } catch {
      toast.error("Failed to load realms");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = async () => {
    setDialogMode("create");
    setDialogForm({ id: 0, name: "", description: "" });
    setSelectedEntityIds([]);
    setEntitySearch("");
    setDialogOpen(true);
    loadAvailableEntities();
  };

  const openEditDialog = async (realm: RealmSummary) => {
    setDialogMode("edit");
    setDialogForm({ id: realm.id, name: realm.name, description: realm.description || "" });
    setSelectedEntityIds(realm.entity_ids || []);
    setEntitySearch("");
    setDialogOpen(true);
    loadAvailableEntities();
  };

  const loadAvailableEntities = async () => {
    setLoadingEntities(true);
    try {
      const data = await RealmService.getAvailableEntities();
      setAvailableEntities(data);
    } catch {} finally {
      setLoadingEntities(false);
    }
  };

  const handleSave = async () => {
    if (!dialogForm.name.trim()) return;
    try {
      if (dialogMode === "create") {
        await RealmService.createRealm(dialogForm.name, dialogForm.description, selectedEntityIds);
        toast.success("Realm created");
      } else {
        await RealmService.updateRealm(dialogForm.id, {
          name: dialogForm.name,
          description: dialogForm.description,
        });
        await RealmService.assignEntities(dialogForm.id, selectedEntityIds);
        toast.success("Realm updated");
      }
      setDialogOpen(false);
      loadRealms();
    } catch {
      toast.error(`Failed to ${dialogMode} realm`);
    }
  };

  const handleDelete = async (realm: RealmSummary) => {
    if (!confirm(`Delete realm "${realm.name}"?`)) return;
    try {
      await RealmService.deleteRealm(realm.id);
      toast.success("Realm deleted");
      loadRealms();
    } catch {
      toast.error("Failed to delete realm");
    }
  };

  const toggleEntity = (entityId: number) => {
    setSelectedEntityIds((prev) =>
      prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId]
    );
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "published":
        return "bg-[#4A9E7B]/10 text-[#4A9E7B]";
      case "draft":
        return "bg-[#C69A4C]/10 text-[#C69A4C]";
      default:
        return "bg-[#718096]/10 text-[#718096]";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader icon={<Globe className="w-7 h-7" />} title="Realms" subtitle="Group entities into realms for independent versioning and Genie publishing." />
        <div className="flex items-center justify-center flex-1">
          <Loader size="medium" message="Loading realms..." textClassName="mt-3 text-sm text-[#718096]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Globe className="w-7 h-7" />}
        title="Realms"
        subtitle="Group entities into realms for independent versioning and Genie publishing."
      />

      <div className="flex-1 overflow-auto p-6">
        {realms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-[#3B6B96]" />
            </div>
            <h3 className="text-base font-semibold text-[#1A2332] mb-1">No realms yet</h3>
            <p className="text-sm text-[#718096] max-w-md mb-4">
              Create a realm to group your entities. Each realm can be versioned and published independently to a Genie workspace.
            </p>
            <button
              onClick={openCreateDialog}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162D4A] transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Your First Realm
            </button>
          </div>
        ) : (
          <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#1A2332]">
              All Realms <span className="text-xs font-normal text-[#A0AEC0]">({realms.length})</span>
            </h2>
            <button
              onClick={openCreateDialog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162D4A] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create Realm
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {realms.map((realm) => (
              <div key={realm.id} className="border border-[#E2E8F0] rounded-lg p-5 hover:border-[#CBD5E0] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#3B6B96]" />
                    <h3 className="text-base font-semibold text-[#1A2332]">{realm.name}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(realm.status)}`}>
                      {realm.status}{realm.latest_version ? ` v${realm.latest_version}` : ""}
                    </span>
                  </div>
                </div>

                {realm.description && (
                  <p className="text-sm text-[#718096] mb-3 line-clamp-2">{realm.description}</p>
                )}

                {/* Entity tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {availableEntities.length === 0 && realm.entity_ids.length > 0 && (
                    <span className="text-xs text-[#A0AEC0]">{realm.entity_count} entities</span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-[#A0AEC0] mb-4">
                  <div className="flex items-center gap-1">
                    <Boxes className="w-3 h-3" />
                    <span>{realm.entity_count} entities</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Table2 className="w-3 h-3" />
                    <span>{realm.table_count} tables</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    <span>{realm.metric_count} metrics</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tags className="w-3 h-3" />
                    <span>{realm.dimension_count} dims</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-[#E2E8F0]">
                  <button
                    onClick={() => openEditDialog(realm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[#3B6B96] hover:bg-[#1E3A5F]/8 transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(realm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[#D46A6A] hover:bg-[#D46A6A]/8 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                  <div className="flex-1" />
                  <span className="text-xs text-[#A0AEC0]">
                    {realm.created_at ? new Date(realm.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
              </div>
            ))}

            {/* Create card */}
            <button
              onClick={openCreateDialog}
              className="border border-dashed border-[#CBD5E0] rounded-lg p-5 flex flex-col items-center justify-center min-h-[200px] text-[#A0AEC0] hover:border-[#1E3A5F] hover:text-[#3B6B96] transition-colors"
            >
              <Plus className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Create new realm</span>
            </button>
          </div>
          </>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} className="w-full max-w-lg max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] shrink-0">
              <h3 className="text-base font-semibold text-[#1A2332]">
                {dialogMode === "create" ? "Create Realm" : "Edit Realm"}
              </h3>
              <button onClick={() => setDialogOpen(false)} className="p-1 rounded text-[#A0AEC0] hover:text-[#4A5568] hover:bg-[#F0F2F5] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">Name</label>
                <input
                  value={dialogForm.name}
                  onChange={(e) => setDialogForm({ ...dialogForm, name: e.target.value })}
                  className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none"
                  placeholder="e.g. Supply Chain Analytics"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  value={dialogForm.description}
                  onChange={(e) => setDialogForm({ ...dialogForm, description: e.target.value })}
                  className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-2 text-sm text-[#1A2332] focus:border-[#1E3A5F] outline-none resize-none"
                  rows={2}
                  placeholder="What is this realm for?"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider block mb-2">
                  Assign Entities
                  <span className="ml-1 font-normal normal-case">({selectedEntityIds.length} selected)</span>
                </label>

                {/* Selected tags */}
                {selectedEntityIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedEntityIds.map((eid) => {
                      const entity = availableEntities.find((e) => e.id === eid);
                      if (!entity) return null;
                      return (
                        <span
                          key={eid}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#1E3A5F]/10 text-[#3B6B96] text-xs font-medium"
                        >
                          {entity.name}
                          <button onClick={() => toggleEntity(eid)} className="hover:text-[#D46A6A] transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Search */}
                <input
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  placeholder="Search entities..."
                  className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-md px-3 py-1.5 text-sm text-[#1A2332] placeholder:text-[#A0AEC0] focus:border-[#1E3A5F] outline-none mb-2"
                />

                {loadingEntities ? (
                  <div className="text-sm text-[#718096] py-4 text-center">Loading entities...</div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto border border-[#E2E8F0] rounded-lg p-1.5">
                    {availableEntities
                      .filter((e) => !entitySearch || e.name.toLowerCase().includes(entitySearch.toLowerCase()) || e.description?.toLowerCase().includes(entitySearch.toLowerCase()))
                      .map((entity) => {
                      const isSelected = selectedEntityIds.includes(entity.id);
                      return (
                        <button
                          key={entity.id}
                          onClick={() => toggleEntity(entity.id)}
                          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors ${
                            isSelected
                              ? "bg-[#1E3A5F]/8 border border-[#1E3A5F]/20"
                              : "hover:bg-[#F5F7FA] border border-transparent"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-[#1E3A5F] border-[#1E3A5F]" : "border-[#CBD5E0]"
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[#1A2332]">{entity.name}</div>
                            <div className="text-xs text-[#A0AEC0]">
                              {entity.table_count} tables · {entity.metric_count} metrics · {entity.dimension_count} dims
                            </div>
                          </div>
                          {entity.realm_ids.length > 0 && !entity.realm_ids.includes(dialogForm.id) && (
                            <span className="text-xs text-[#A0AEC0] bg-[#F0F2F5] px-1.5 py-0.5 rounded">
                              in {entity.realm_ids.length} realm{entity.realm_ids.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#E2E8F0] shrink-0">
              <button onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-md text-sm text-[#718096] hover:bg-[#F0F2F5] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!dialogForm.name.trim()}
                className="px-4 py-2 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#162D4A] transition-colors disabled:opacity-50"
              >
                {dialogMode === "create" ? "Create Realm" : "Save Changes"}
              </button>
            </div>
      </Dialog>
    </div>
  );
}
