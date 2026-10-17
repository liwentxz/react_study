"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileImageOutlined,
  InboxOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  listReports,
  newId,
  readFile,
  removeReport,
  saveReports,
  updateMeta,
} from "../lib/reportStore";

const GROUP_OPTIONS = [
  { label: "按日期", value: "date" },
  { label: "按品牌", value: "brand" },
  { label: "按型号", value: "model" },
  { label: "不分组", value: "none" },
];

const fmtSize = (b) => {
  if (!b) return "0 KB";
  return b < 1048576
    ? (b / 1024).toFixed(0) + " KB"
    : (b / 1048576).toFixed(2) + " MB";
};

const sortItems = (a, b) =>
  String(b.reportDate || "").localeCompare(String(a.reportDate || "")) ||
  (b.createdAt || 0) - (a.createdAt || 0);

async function makeThumb(file) {
  try {
    const bmp = await createImageBitmap(file);
    const max = 520;
    const sw = bmp.width || 1;
    const sh = bmp.height || 1;
    const scale = Math.min(1, max / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.82));
    return blob || null;
  } catch {
    return null;
  }
}

function makeGroupKey(it, groupBy) {
  if (groupBy === "brand") return it.brand || "未知品牌";
  if (groupBy === "model") return it.model || "未知型号";
  if (groupBy === "date") return (it.reportDate || "").slice(0, 7) || "未填日期";
  return "全部报告";
}

export default function ReportsTab({ devices = [], onCountChange }) {
  const { message, modal } = App.useApp();
  const [items, setItems] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [range, setRange] = useState(null);
  const [brand, setBrand] = useState();
  const [model, setModel] = useState();
  const [keyword, setKeyword] = useState("");
  const [groupBy, setGroupBy] = useState("date");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [form] = Form.useForm();
  const urlRef = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listReports();
      list.sort(sortItems);
      setItems(list);
      setDbError("");
      if (onCountChange) onCountChange(list.length);
    } catch (e) {
      setDbError(e?.message || "读取检测报告失败");
    }
    setLoading(false);
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      await Promise.all(
        items.map(async (it) => {
          try {
            const rec = await readFile(it.id);
            const b = rec?.thumb || rec?.full;
            if (b) next[it.id] = URL.createObjectURL(b);
          } catch {}
        }),
      );
      if (cancelled) {
        Object.values(next).forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      const old = urlRef.current;
      urlRef.current = next;
      setThumbs(next);
      Object.values(old).forEach((u) => URL.revokeObjectURL(u));
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  useEffect(
    () => () => {
      Object.values(urlRef.current).forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  useEffect(
    () => () => {
      if (preview?.url) {
        const u = preview.url;
        // 等关闭动画结束再释放，避免预览大图闪空白
        setTimeout(() => URL.revokeObjectURL(u), 800);
      }
    },
    [preview],
  );

  const filtered = useMemo(
    () =>
      items.filter((it) => {
        if (range && range[0] && range[1]) {
          const d = it.reportDate || "";
          if (d < range[0].format("YYYY-MM-DD")) return false;
          if (d > range[1].format("YYYY-MM-DD")) return false;
        }
        if (brand && (it.brand || "") !== brand) return false;
        if (model && (it.model || "") !== model) return false;
        const kw = keyword.trim().toLowerCase();
        if (kw && !(it.fileName || "").toLowerCase().includes(kw)) return false;
        return true;
      }),
    [items, range, brand, model, keyword],
  );

  const groups = useMemo(() => {
    const m = new Map();
    filtered.forEach((it) => {
      const k = makeGroupKey(it, groupBy);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(it);
    });
    const arr = [...m.entries()];
    if (groupBy !== "none")
      arr.sort((a, b) => {
        const au = a[0].startsWith("未");
        const bu = b[0].startsWith("未");
        if (au !== bu) return au ? 1 : -1;
        return groupBy === "date"
          ? b[0].localeCompare(a[0])
          : a[0].localeCompare(b[0], "zh-CN");
      });
    return arr;
  }, [filtered, groupBy]);

  const brandOptions = useMemo(() => {
    const s = new Set();
    devices.forEach((d) => d.brand && s.add(d.brand));
    items.forEach((i) => i.brand && s.add(i.brand));
    return [...s]
      .sort((a, b) => a.localeCompare(b, "zh-CN"))
      .map((v) => ({ value: v, label: v }));
  }, [devices, items]);

  const modelOptions = useMemo(() => {
    const s = new Set();
    devices.forEach((d) => {
      if (d.model && (!brand || d.brand === brand)) s.add(d.model);
    });
    items.forEach((i) => {
      if (i.model && (!brand || i.brand === brand)) s.add(i.model);
    });
    return [...s]
      .sort((a, b) => a.localeCompare(b, "zh-CN"))
      .map((v) => ({ value: v, label: v }));
  }, [devices, items, brand]);

  const totalSize = useMemo(
    () => items.reduce((s, it) => s + (it.size || 0), 0),
    [items],
  );

  const openUpload = () => {
    setEditing(null);
    setFiles([]);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (it) => {
    setEditing(it);
    setFiles([]);
    form.setFieldsValue({
      reportDate: it.reportDate ? dayjs(it.reportDate) : null,
      brand: it.brand || undefined,
      model: it.model || undefined,
      serial: it.serial || undefined,
    });
    setOpen(true);
  };

  const submit = async () => {
    let v;
    try {
      v = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const reportDate = v.reportDate ? v.reportDate.format("YYYY-MM-DD") : "";
      if (editing) {
        await updateMeta(editing.id, {
          reportDate,
          brand: v.brand || "",
          model: v.model || "",
          serial: v.serial || "",
        });
        message.success("已更新分类信息");
      } else {
        if (!files.length) {
          message.error("请先选择检测报告图片");
          setSaving(false);
          return;
        }
        const records = [];
        for (const f of files) {
          const thumb = await makeThumb(f);
          records.push({
            id: newId(),
            reportDate,
            brand: v.brand || "",
            model: v.model || "",
            serial: v.serial || "",
            fileName: f.name,
            fileType: f.type || "",
            size: f.size || 0,
            createdAt: Date.now(),
            full: f,
            thumb,
          });
        }
        await saveReports(records);
        message.success(`已保存 ${records.length} 张检测报告`);
      }
      setOpen(false);
      await load();
    } catch (e) {
      message.error("保存失败：" + (e?.message || "未知错误"));
    }
    setSaving(false);
  };

  const openPreview = async (it) => {
    try {
      const rec = await readFile(it.id);
      if (!rec?.full) return message.error("原图丢失，无法预览");
      setPreview({ meta: it, url: URL.createObjectURL(rec.full) });
    } catch {
      message.error("读取原图失败");
    }
  };

  const download = async (it) => {
    try {
      const rec = await readFile(it.id);
      if (!rec?.full) return message.error("原图丢失，无法下载");
      const url = URL.createObjectURL(rec.full);
      const a = document.createElement("a");
      a.href = url;
      a.download = it.fileName || "report.jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      message.error("下载失败");
    }
  };

  const del = (it) => {
    modal.confirm({
      title: "删除该检测报告？",
      content: it.fileName,
      okButtonProps: { danger: true },
      onOk: async () => {
        await removeReport(it.id);
        message.success("已删除");
        await load();
      },
    });
  };

  const clear = () => {
    setRange(null);
    setBrand(undefined);
    setModel(undefined);
    setKeyword("");
  };

  const renderCard = (it) => (
    <div
      key={it.id}
      style={{
        border: "1px solid #eef0f7",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <div
        onClick={() => openPreview(it)}
        style={{
          height: 112,
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "zoom-in",
        }}
      >
        {thumbs[it.id] ? (
          <img
            src={thumbs[it.id]}
            alt={it.fileName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <FileImageOutlined style={{ fontSize: 26, color: "#cbd5e1" }} />
        )}
      </div>
      <div style={{ padding: "6px 8px 4px" }}>
        <div
          title={it.fileName}
          style={{
            fontSize: 12,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {it.fileName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#94a3b8",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {it.reportDate || "无日期"} · {it.brand || "无品牌"}{" "}
          {it.model || ""} {it.serial ? `· ${it.serial}` : ""}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 2,
          }}
        >
          <span style={{ fontSize: 11, color: "#cbd5e1" }}>
            {fmtSize(it.size)}
          </span>
          <Space size={0}>
            <Button
              size="small"
              type="text"
              icon={<DownloadOutlined />}
              onClick={() => download(it)}
            />
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEdit(it)}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => del(it)}
            />
          </Space>
        </div>
      </div>
    </div>
  );

  if (dbError)
    return (
      <Card>
        <Empty description={dbError} />
      </Card>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800 }}>📷 检测报告图库</div>
          <Tag color="blue">共 {items.length} 张</Tag>
          <Tag>占用 {fmtSize(totalSize)}</Tag>
          <span style={{ flex: 1 }} />
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={openUpload}
          >
            上传检测报告
          </Button>
        </div>
      </Card>
      <Card>
        <Space wrap size={[14, 12]}>
          <Space size={6}>
            <span>日期</span>
            <DatePicker.RangePicker
              value={range}
              onChange={setRange}
              allowClear
            />
          </Space>
          <Space size={6}>
            <span>品牌</span>
            <Select
              allowClear
              showSearch
              style={{ width: 140 }}
              value={brand}
              onChange={(v) => {
                setBrand(v);
                setModel(undefined);
              }}
              options={brandOptions}
            />
          </Space>
          <Space size={6}>
            <span>型号</span>
            <Select
              allowClear
              showSearch
              style={{ width: 160 }}
              value={model}
              onChange={setModel}
              options={modelOptions}
            />
          </Space>
          <Space size={6}>
            <span>文件名</span>
            <Input
              allowClear
              style={{ width: 200 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </Space>
          <Space size={6}>
            <span>分类</span>
            <Segmented
              value={groupBy}
              onChange={setGroupBy}
              options={GROUP_OPTIONS}
            />
          </Space>
          <Button onClick={clear}>清空</Button>
        </Space>
      </Card>
      <Card>
        <Spin spinning={loading}>
          {filtered.length === 0 ? (
            <Empty
              description={
                items.length ? "没有匹配的检测报告" : "还没有上传检测报告图片"
              }
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {groups.map(([name, list]) => (
                <div key={name}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <b style={{ fontSize: 14 }}>{name}</b>
                    <Tag>{list.length} 张</Tag>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(158px,1fr))",
                      gap: 12,
                    }}
                  >
                    {list.map(renderCard)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Spin>
      </Card>
      <Modal
        open={open}
        title={editing ? "编辑分类信息" : "上传检测报告"}
        okText={editing ? "保存修改" : "开始上传"}
        confirmLoading={saving}
        onOk={submit}
        onCancel={() => setOpen(false)}
        forceRender
        width={640}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="reportDate"
                label="报告日期"
                rules={[{ required: true, message: "请选择报告日期" }]}
              >
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="brand" label="品牌">
                <Select
                  allowClear
                  showSearch
                  options={brandOptions}
                  onChange={() => form.setFieldValue("model", undefined)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model" label="型号">
                <Select allowClear showSearch options={modelOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serial" label="序列号">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        {!editing && (
          <>
            <Upload.Dragger
              multiple
              accept="image/*"
              showUploadList={false}
              beforeUpload={(f) => {
                setFiles((p) => [...p, f]);
                return false;
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽图片到此处</p>
              <p className="ant-upload-hint">
                支持一次多选，多个文件共用上面的日期与品牌型号
              </p>
            </Upload.Dragger>
            <div style={{ marginTop: 10, minHeight: 24 }}>
              {files.length === 0 ? (
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  尚未选择文件
                </span>
              ) : (
                files.map((f, i) => (
                  <Tag
                    key={f.name + i}
                    closable
                    onClose={() =>
                      setFiles((p) => p.filter((_, j) => j !== i))
                    }
                    style={{ marginBottom: 4 }}
                  >
                    {f.name} · {fmtSize(f.size)}
                  </Tag>
                ))
              )}
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={!!preview}
        title={preview?.meta.fileName}
        footer={null}
        width={900}
        onCancel={() => setPreview(null)}
      >
        {preview && (
          <div>
            <div
              style={{
                background: "#f8fafc",
                borderRadius: 8,
                padding: 8,
                textAlign: "center",
              }}
            >
              <img
                src={preview.url}
                alt={preview.meta.fileName}
                style={{ maxWidth: "100%", maxHeight: "68vh" }}
              />
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "#64748b",
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span>日期 {preview.meta.reportDate || "—"}</span>
              <span>品牌 {preview.meta.brand || "—"}</span>
              <span>型号 {preview.meta.model || "—"}</span>
              <span>序列号 {preview.meta.serial || "—"}</span>
              <span>大小 {fmtSize(preview.meta.size)}</span>
              <span style={{ flex: 1 }} />
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => download(preview.meta)}
              >
                下载原图
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
