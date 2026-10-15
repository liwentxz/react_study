"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  App,
  ConfigProvider,
  Card,
  Row,
  Col,
  Statistic,
  Tabs,
  Table,
  Tag,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Space,
  Upload,
  message,
  Modal,
  InputNumber as IN,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EditOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import zhCN from "antd/locale/zh_CN";
import { Resizable } from "react-resizable";
import * as XLSX from "xlsx";
dayjs.locale("zh-cn");

const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

const KEY = "device_ledger_v1";
const METHOD_OPTIONS = [
  "当面",
  "邮寄",
  "咸鱼",
  "小红书",
  "微信",
  "抖音",
  "转转",
  "同行",
  "其他",
];
const toArr = (v) =>
  Array.isArray(v)
    ? v.filter(Boolean)
    : String(v || "")
        .split(/[、,，/]+/)
        .map((s) => s.trim())
        .filter(Boolean);
const joinMethod = (v) => toArr(v).join("、");
const n = (v) => Number(v) || 0;
const calcProfit = (r) =>
  n(r.sellPrice) -
  n(r.buyPrice) -
  n(r.accessoryFee) -
  n(r.repairFee) -
  n(r.exposeFee) -
  n(r.buyShipFee) -
  n(r.sellShipFee) -
  n(r.agentFee) -
  n(r.platformFee);
const fmt = (v) => "¥" + (Number(v) || 0).toLocaleString();
const monthKey = (d) => (d || "").slice(0, 7);
function weekKey(d) {
  if (!d) return "";
  const dt = new Date(d);
  const o = new Date(dt.getFullYear(), 0, 1);
  const w = Math.ceil(((dt - o) / 86400000 + o.getDay() + 1) / 7);
  return `${dt.getFullYear()}-W${String(w).padStart(2, "0")}`;
}
function Inner() {
  const { message } = App.useApp();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("home");
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [qform] = Form.useForm();
  const [filters, setFilters] = useState({});
  const [colWidths, setColWidths] = useState({});
  const handleResize =
    (key) =>
    (e, { size }) => {
      setColWidths((p) => ({ ...p, [key]: size.width }));
    };
  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setRows(JSON.parse(raw));
      else setRows([]);
    } catch {
      setRows([]);
    }
  }, []);
  useEffect(() => {
    if (mounted)
      try {
        localStorage.setItem(KEY, JSON.stringify(rows));
      } catch {}
  }, [rows, mounted]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const f = filters;
        if (f.day && r.buyDate !== f.day) return false;
        if (f.week && weekKey(r.buyDate) !== f.week) return false;
        if (f.month && monthKey(r.buyDate) !== f.month) return false;
        if (f.year && !(r.buyDate || "").startsWith(String(f.year)))
          return false;
        if (f.brand && !(r.brand || "").includes(f.brand)) return false;
        if (f.model && !(r.model || "").includes(f.model)) return false;
        if (f.memory && !(r.memory || "").includes(f.memory)) return false;
        if (f.status === "sold" && !(n(r.sellPrice) > 0)) return false;
        if (f.status === "stock" && n(r.sellPrice) > 0) return false;
        if (f.keyword && !JSON.stringify(r).includes(f.keyword)) return false;
        return true;
      }),
    [rows, filters],
  );

  const total = {
    buy: rows.reduce((s, r) => s + n(r.buyPrice), 0),
    sell: rows.reduce((s, r) => s + n(r.sellPrice), 0),
    profit: rows.reduce((s, r) => s + calcProfit(r), 0),
    fee: rows.reduce(
      (s, r) =>
        s +
        n(r.accessoryFee) +
        n(r.repairFee) +
        n(r.exposeFee) +
        n(r.buyShipFee) +
        n(r.sellShipFee) +
        n(r.agentFee) +
        n(r.platformFee),
      0,
    ),
  };
  const monthly = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const k = monthKey(r.buyDate);
      if (!k) return;
      map[k] = map[k] || { month: k, count: 0, buy: 0, sell: 0, profit: 0 };
      map[k].count++;
      map[k].buy += n(r.buyPrice);
      map[k].sell += n(r.sellPrice);
      map[k].profit += calcProfit(r);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [rows]);
  const maxSell = Math.max(1, ...monthly.map((m) => m.sell));
  const maxAbsProfit = Math.max(1, ...monthly.map((x) => Math.abs(x.profit)));
  const soldRows = useMemo(
    () => rows.filter((r) => n(r.sellPrice) > 0),
    [rows],
  );
  const stockRows = useMemo(
    () => rows.filter((r) => !(n(r.sellPrice) > 0)),
    [rows],
  );
  const avgProfit = soldRows.length
    ? Math.round(total.profit / soldRows.length)
    : 0;
  const margin = total.sell ? (total.profit / total.sell) * 100 : 0;
  const stockValue = useMemo(
    () => stockRows.reduce((s, r) => s + n(r.buyPrice), 0),
    [stockRows],
  );
  const feeBreak = useMemo(() => {
    const o = {
      accessoryFee: 0,
      repairFee: 0,
      exposeFee: 0,
      buyShipFee: 0,
      sellShipFee: 0,
      agentFee: 0,
      platformFee: 0,
    };
    rows.forEach((r) => {
      Object.keys(o).forEach((k) => (o[k] += n(r[k])));
    });
    const labels = {
      accessoryFee: "配件",
      repairFee: "维修",
      exposeFee: "曝光",
      buyShipFee: "收购邮费",
      sellShipFee: "出售邮费",
      agentFee: "代理",
      platformFee: "平台",
    };
    return Object.entries(o)
      .map(([k, v]) => ({
        key: k,
        name: labels[k],
        value: v,
        pct: total.fee ? (v / total.fee) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [rows, total.fee]);
  const maxFee = Math.max(1, ...feeBreak.map((f) => f.value));
  const brandStat = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      const k = r.brand || "未知";
      m[k] = m[k] || { brand: k, count: 0, sold: 0, sell: 0, profit: 0 };
      m[k].count++;
      if (r.sellPrice) m[k].sold++;
      m[k].sell += n(r.sellPrice);
      m[k].profit += calcProfit(r);
    });
    return Object.values(m).sort((a, b) => b.profit - a.profit);
  }, [rows]);
  const methodStat = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      toArr(r.sellMethod).forEach((k) => {
        const key = k || "未售";
        m[key] = m[key] || { name: key, count: 0, profit: 0 };
        m[key].count++;
        m[key].profit += calcProfit(r);
      });
      if (toArr(r.sellMethod).length === 0) {
        m["未售"] = m["未售"] || { name: "未售", count: 0, profit: 0 };
        m["未售"].count++;
        m["未售"].profit += calcProfit(r);
      }
    });
    return Object.values(m).sort((a, b) => b.count - a.count);
  }, [rows]);
  const bestMonth = monthly.length
    ? [...monthly].sort((a, b) => b.profit - a.profit)[0]
    : null;
  const recentSold = useMemo(
    () =>
      [...soldRows]
        .sort((a, b) =>
          String(b.incomeDate || b.sellSendDate || "").localeCompare(
            String(a.incomeDate || a.sellSendDate || ""),
          ),
        )
        .slice(0, 6),
    [soldRows],
  );

  const isSold = (r) => n(r.sellPrice) > 0;
  const feeOf = (r) =>
    n(r.accessoryFee) +
    n(r.repairFee) +
    n(r.exposeFee) +
    n(r.buyShipFee) +
    n(r.sellShipFee) +
    n(r.agentFee) +
    n(r.platformFee);
  const columns = [
    {
      title: "收购日期",
      dataIndex: "buyDate",
      key: "buyDate",
      width: 105,
      fixed: "left",
    },
    {
      title: "品牌",
      dataIndex: "brand",
      key: "brand",
      width: 90,
      fixed: "left",
    },
    {
      title: "型号",
      dataIndex: "model",
      key: "model",
      width: 130,
      fixed: "left",
    },
    { title: "颜色", dataIndex: "color", key: "color", width: 80 },
    { title: "内存", dataIndex: "memory", key: "memory", width: 100 },
    {
      title: "收购价格",
      dataIndex: "buyPrice",
      key: "buyPrice",
      width: 95,
      render: (v) => fmt(v),
      sorter: (a, b) => n(a.buyPrice) - n(b.buyPrice),
    },
    {
      title: "出售价格",
      dataIndex: "sellPrice",
      key: "sellPrice",
      width: 95,
      render: (v) => (n(v) ? fmt(v) : "-"),
      sorter: (a, b) => n(a.sellPrice) - n(b.sellPrice),
    },
    {
      title: "配件费",
      dataIndex: "accessoryFee",
      key: "accessoryFee",
      width: 80,
      render: (v) => fmt(v),
    },
    {
      title: "维修费",
      dataIndex: "repairFee",
      key: "repairFee",
      width: 80,
      render: (v) => fmt(v),
    },
    {
      title: "曝光费",
      dataIndex: "exposeFee",
      key: "exposeFee",
      width: 80,
      render: (v) => fmt(v),
    },
    {
      title: "收购邮费",
      dataIndex: "buyShipFee",
      key: "buyShipFee",
      width: 90,
      render: (v) => fmt(v),
    },
    {
      title: "出售邮费",
      dataIndex: "sellShipFee",
      key: "sellShipFee",
      width: 90,
      render: (v) => fmt(v),
    },
    {
      title: "代理费",
      dataIndex: "agentFee",
      key: "agentFee",
      width: 80,
      render: (v) => fmt(v),
    },
    {
      title: "平台费",
      dataIndex: "platformFee",
      key: "platformFee",
      width: 80,
      render: (v) => fmt(v),
    },
    {
      title: "费用合计",
      key: "feeAll",
      width: 95,
      render: (_, r) => fmt(feeOf(r)),
      sorter: (a, b) => feeOf(a) - feeOf(b),
    },
    {
      title: "利润",
      key: "p",
      width: 100,
      render: (_, r) => {
        const p = calcProfit(r);
        return (
          <span
            style={{ color: p >= 0 ? "#16a34a" : "#e11d48", fontWeight: 800 }}
          >
            {fmt(p)}
          </span>
        );
      },
      sorter: (a, b) => calcProfit(a) - calcProfit(b),
    },
    {
      title: "状态",
      key: "s",
      width: 80,
      filters: [
        { text: "已售", value: "sold" },
        { text: "在库", value: "stock" },
      ],
      onFilter: (v, r) => (v === "sold" ? isSold(r) : !isSold(r)),
      render: (_, r) =>
        isSold(r) ? (
          <Tag color="green">已售</Tag>
        ) : (
          <Tag color="default">在库</Tag>
        ),
    },
    {
      title: "机况描述",
      dataIndex: "condition",
      key: "condition",
      width: 160,
      ellipsis: true,
    },
    { title: "收购地址", dataIndex: "buyAddr", key: "buyAddr", width: 100 },
    {
      title: "收购方式",
      dataIndex: "buyMethod",
      key: "buyMethod",
      width: 150,
      render: (v) =>
        toArr(v).length ? (
          <span>
            {toArr(v).map((x) => (
              <Tag key={x}>{x}</Tag>
            ))}
          </span>
        ) : (
          "-"
        ),
    },
    {
      title: "出售地址",
      dataIndex: "sellAddr",
      key: "sellAddr",
      width: 100,
      render: (v) => v || "-",
    },
    {
      title: "出售方式",
      dataIndex: "sellMethod",
      key: "sellMethod",
      width: 180,
      render: (v) =>
        toArr(v).length ? (
          <span>
            {toArr(v).map((x) => (
              <Tag key={x} color="blue">
                {x}
              </Tag>
            ))}
          </span>
        ) : (
          "-"
        ),
    },
    {
      title: "收购发货日期",
      dataIndex: "buySendDate",
      key: "buySendDate",
      width: 115,
    },
    {
      title: "收购到货日期",
      dataIndex: "buyArriveDate",
      key: "buyArriveDate",
      width: 115,
    },
    {
      title: "出售发货日期",
      dataIndex: "sellSendDate",
      key: "sellSendDate",
      width: 115,
      render: (v) => v || "-",
    },
    {
      title: "出售到货日期",
      dataIndex: "sellArriveDate",
      key: "sellArriveDate",
      width: 115,
      render: (v) => v || "-",
    },
    {
      title: "入账日期",
      dataIndex: "incomeDate",
      key: "incomeDate",
      width: 105,
      render: (v) => v || "-",
      sorter: (a, b) =>
        String(a.incomeDate || "").localeCompare(String(b.incomeDate || "")),
    },
    {
      title: "操作",
      key: "op",
      fixed: "right",
      width: 150,
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(r.id);
              Object.entries(r).forEach(([k, v]) => {});
              form.setFieldsValue({
                ...r,
                buyMethod: toArr(r.buyMethod),
                sellMethod: toArr(r.sellMethod),
                buyDate: r.buyDate ? dayjs(r.buyDate) : null,
                buySendDate: r.buySendDate ? dayjs(r.buySendDate) : null,
                buyArriveDate: r.buyArriveDate ? dayjs(r.buyArriveDate) : null,
                sellSendDate: r.sellSendDate ? dayjs(r.sellSendDate) : null,
                sellArriveDate: r.sellArriveDate
                  ? dayjs(r.sellArriveDate)
                  : null,
                incomeDate: r.incomeDate ? dayjs(r.incomeDate) : null,
              });
              setTab("form");
            }}
          >
            编辑
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() =>
              Modal.confirm({
                title: "删除该记录？",
                onOk: () => setRows((p) => p.filter((x) => x.id !== r.id)),
              })
            }
          />
        </Space>
      ),
    },
  ];

  const mergedColumns = columns.map((c) => ({
    ...c,
    width: colWidths[c.key] ?? c.width,
    onHeaderCell: (col) => ({
      width: colWidths[col.key] ?? col.width,
      onResize: handleResize(col.key),
    }),
  }));

  const onFinish = (v) => {
    const o = { ...v };
    [
      "buyDate",
      "buySendDate",
      "buyArriveDate",
      "sellSendDate",
      "sellArriveDate",
      "incomeDate",
    ].forEach((k) => {
      o[k] = v[k] ? v[k].format("YYYY-MM-DD") : "";
    });
    o.buyMethod = joinMethod(v.buyMethod);
    o.sellMethod = joinMethod(v.sellMethod);
    if (!o.buyDate) return message.error("请填写收购日期");
    if (editing)
      setRows((p) =>
        p.map((r) => (r.id === editing ? { ...o, id: editing } : r)),
      );
    else setRows((p) => [{ ...o, id: "id" + Date.now() }, ...p]);
    form.resetFields();
    setEditing(null);
    setTab("list");
    message.success("保存成功，利润 " + fmt(calcProfit(o)));
  };
  const doExport = () => {
    const labels = [
      "收购日期",
      "品牌",
      "型号",
      "颜色",
      "内存",
      "收购价格",
      "出售价格",
      "配件费",
      "维修费",
      "曝光费",
      "收购邮费",
      "出售邮费",
      "代理费",
      "平台费",
      "机况描述",
      "收购地址",
      "收购方式",
      "出售地址",
      "出售方式",
      "收购发货日期",
      "收购到货日期",
      "出售发货日期",
      "出售到货日期",
      "入账日期",
      "利润(自动)",
    ];
    const keys = [
      "buyDate",
      "brand",
      "model",
      "color",
      "memory",
      "buyPrice",
      "sellPrice",
      "accessoryFee",
      "repairFee",
      "exposeFee",
      "buyShipFee",
      "sellShipFee",
      "agentFee",
      "platformFee",
      "condition",
      "buyAddr",
      "buyMethod",
      "sellAddr",
      "sellMethod",
      "buySendDate",
      "buyArriveDate",
      "sellSendDate",
      "sellArriveDate",
      "incomeDate",
    ];
    const data = filtered.map((r) => {
      const o = {};
      labels.forEach((lb, i) => {
        if (i < keys.length) {
          const k = keys[i];
          o[lb] =
            k === "buyMethod" || k === "sellMethod"
              ? joinMethod(r[k])
              : (r[k] ?? "");
        } else {
          o[lb] = calcProfit(r);
        }
      });
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = labels.map(() => ({ wch: 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "出入账");
    XLSX.writeFile(wb, `出入账_${dayjs().format("YYYY-MM-DD")}.xlsx`);
    message.success(`导出 ${filtered.length} 条`);
  };
  const doImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        aoa.shift();
        const keyOrder = [
          "buyDate",
          "brand",
          "model",
          "color",
          "memory",
          "buyPrice",
          "sellPrice",
          "accessoryFee",
          "repairFee",
          "exposeFee",
          "buyShipFee",
          "sellShipFee",
          "agentFee",
          "platformFee",
          "condition",
          "buyAddr",
          "buyMethod",
          "sellAddr",
          "sellMethod",
          "buySendDate",
          "buyArriveDate",
          "sellSendDate",
          "sellArriveDate",
          "incomeDate",
        ];
        const fmtDate = (v) => {
          if (v === "" || v == null) return "";
          if (typeof v === "number") {
            const d = XLSX.SSF ? XLSX.SSF.parse_date_code(v) : null;
            if (d)
              return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
            return String(v);
          }
          const s = String(v).trim();
          const m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
          if (m)
            return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
          return s;
        };
        const arr = aoa
          .filter((row) => row.some((c) => String(c).trim() !== ""))
          .map((row, i) => {
            const o = { id: "imp" + Date.now() + i };
            keyOrder.forEach((k, idx) => {
              let v = row[idx] ?? "";
              if (
                [
                  "buyDate",
                  "buySendDate",
                  "buyArriveDate",
                  "sellSendDate",
                  "sellArriveDate",
                  "incomeDate",
                ].includes(k)
              )
                v = fmtDate(v);
              else if (typeof v === "string") v = v.trim();
              o[k] = v;
            });
            return o;
          });
        setRows((p) => [...arr, ...p]);
        message.success(`导入成功 ${arr.length} 条`);
      } catch {
        message.error("导入失败，请检查 xlsx 格式");
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  if (!mounted) return <Card loading />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card
        style={{
          background: "linear-gradient(135deg,#1e1b4b,#5b50e8 60%,#9d4edd)",
          border: "none",
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            二手设备出入账管理系统
          </div>
          <Tag color="gold">
            共 {rows.length} 台 · 已售{" "}
            {rows.filter((r) => n(r.sellPrice) > 0).length} · 在库{" "}
            {rows.filter((r) => !(n(r.sellPrice) > 0)).length}
          </Tag>
          <span style={{ flex: 1 }} />
          <Space>
            <Button
              onClick={() => {
                form.resetFields();
                setEditing(null);
                setTab("form");
              }}
              type="primary"
              icon={<PlusOutlined />}
            >
              填报新机
            </Button>
          </Space>
        </div>
      </Card>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: "home", label: "首页分析" },
          { key: "list", label: `明细列表 (${filtered.length})` },
          { key: "form", label: editing ? "编辑记录" : "填报表单" },
        ]}
      />
      {tab === "home" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Row gutter={[14, 14]}>
            <Col xs={12} md={5}>
              <Card style={{ borderTop: "3px solid #5b50e8" }}>
                <Statistic title="累计台数" value={rows.length} suffix="台" />
                <div style={{ marginTop: 6 }}>
                  <Tag color="green">已售 {soldRows.length}</Tag>
                  <Tag>在库 {stockRows.length}</Tag>
                </div>
              </Card>
            </Col>
            <Col xs={12} md={5}>
              <Card style={{ borderTop: "3px solid #f59e0b" }}>
                <Statistic
                  title="收购支出 / 在库货值"
                  value={total.buy}
                  prefix="¥"
                />
                <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                  在库占用 {fmt(stockValue)}
                </div>
              </Card>
            </Col>
            <Col xs={12} md={5}>
              <Card style={{ borderTop: "3px solid #0ea5e9" }}>
                <Statistic title="出售收入" value={total.sell} prefix="¥" />
                <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                  费用合计 {fmt(total.fee)}
                </div>
              </Card>
            </Col>
            <Col xs={12} md={5}>
              <Card style={{ borderTop: "3px solid #16a34a" }}>
                <Statistic
                  title="累计利润 / 利润率"
                  value={total.profit}
                  prefix="¥"
                  styles={{
                    content: {
                      color: total.profit >= 0 ? "#16a34a" : "#e11d48",
                    },
                  }}
                />
                <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                  利润率 {margin.toFixed(1)}% · 均台 {fmt(avgProfit)}
                </div>
              </Card>
            </Col>
            <Col xs={24} md={4}>
              <Card
                style={{
                  background: "linear-gradient(135deg,#0f172a,#5b50e8)",
                  border: "none",
                  color: "#fff",
                  height: "100%",
                }}
              >
                <div style={{ color: "#fff", fontSize: 13, opacity: 0.8 }}>
                  最佳月份
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>
                  {bestMonth ? bestMonth.month : "—"}
                </div>
                <div style={{ color: "#bbf7d0", fontWeight: 800 }}>
                  {bestMonth
                    ? fmt(bestMonth.profit) + " / " + bestMonth.count + "台"
                    : "暂无"}
                </div>
              </Card>
            </Col>
          </Row>
          <Row gutter={[14, 14]}>
            <Col xs={24} lg={14}>
              <Card
                title="📊 月度经营趋势（收入 / 利润双柱）"
                extra={<Tag color="blue">共 {monthly.length} 个月</Tag>}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 12,
                    height: 250,
                    background: "linear-gradient(180deg,#f8faff,#fff)",
                    borderRadius: 12,
                    padding: "18px 12px 8px",
                    border: "1px solid #eef0f7",
                  }}
                >
                  {monthly.length === 0 ? (
                    <div style={{ color: "#999", margin: "auto" }}>
                      暂无数据
                    </div>
                  ) : (
                    monthly.map((m) => {
                      const hs = Math.max(8, (m.sell / maxSell) * 160),
                        hp = Math.max(
                          m.profit > 0 ? 8 : 2,
                          (Math.abs(m.profit) / maxAbsProfit) * 120,
                        );
                      return (
                        <div
                          key={m.month}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 5,
                            height: "100%",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: m.profit >= 0 ? "#16a34a" : "#e11d48",
                            }}
                          >
                            {m.profit}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-end",
                              gap: 4,
                              height: 170,
                            }}
                          >
                            <div
                              title={`出售 ${fmt(m.sell)}`}
                              style={{
                                width: 18,
                                height: hs,
                                borderRadius: "6px 6px 3px 3px",
                                background:
                                  "linear-gradient(180deg,#a5b4fc,#5b50e8)",
                              }}
                            />
                            <div
                              title={`利润 ${fmt(m.profit)}`}
                              style={{
                                width: 18,
                                height: hp,
                                borderRadius: "6px 6px 3px 3px",
                                background:
                                  m.profit >= 0
                                    ? "linear-gradient(180deg,#6ee7b7,#059669)"
                                    : "linear-gradient(180deg,#fda4af,#e11d48)",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              color: "#666",
                              fontWeight: 700,
                            }}
                          >
                            {m.month.slice(5)}月
                          </span>
                          <span style={{ fontSize: 11, color: "#999" }}>
                            {m.count}台
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    marginTop: 8,
                    fontSize: 12,
                    color: "#666",
                  }}
                >
                  <span>
                    <i
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        background: "#5b50e8",
                        borderRadius: 3,
                        marginRight: 4,
                      }}
                    />
                    出售收入
                  </span>
                  <span>
                    <i
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        background: "#059669",
                        borderRadius: 3,
                        marginRight: 4,
                      }}
                    />
                    利润
                  </span>
                  <span>
                    <i
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        background: "#e11d48",
                        borderRadius: 3,
                        marginRight: 4,
                      }}
                    />
                    亏损
                  </span>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card
                title="💸 费用结构拆解"
                extra={
                  <span style={{ fontSize: 12, color: "#888" }}>
                    合计 {fmt(total.fee)}
                  </span>
                }
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {feeBreak.map((f) => (
                    <div key={f.key}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                        }}
                      >
                        <span>{f.name}</span>
                        <b>
                          {fmt(f.value)} · {f.pct.toFixed(0)}%
                        </b>
                      </div>
                      <div
                        style={{
                          height: 8,
                          background: "#f1f5f9",
                          borderRadius: 99,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${(f.value / maxFee) * 100}%`,
                            height: "100%",
                            borderRadius: 99,
                            background:
                              "linear-gradient(90deg,#fbbf24,#f97316)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>
          <Row gutter={[14, 14]}>
            <Col xs={24} lg={8}>
              <Card title="🏆 品牌利润榜">
                <Table
                  size="small"
                  pagination={false}
                  dataSource={brandStat}
                  rowKey="brand"
                  columns={[
                    {
                      title: "品牌",
                      dataIndex: "brand",
                      render: (v, i) => (
                        <Space>
                          <Tag color={i < 3 ? "gold" : "default"}>
                            {brandStat.indexOf(
                              brandStat.find((x) => x.brand === v),
                            ) + 1}
                          </Tag>
                          <b>{v}</b>
                        </Space>
                      ),
                    },
                    {
                      title: "台数/已售",
                      key: "c",
                      render: (_, r) => `${r.count}/${r.sold}`,
                    },
                    {
                      title: "利润",
                      dataIndex: "profit",
                      render: (v) => (
                        <b style={{ color: v >= 0 ? "#16a34a" : "#e11d48" }}>
                          {fmt(v)}
                        </b>
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="📦 月度明细">
                <Table
                  size="small"
                  pagination={{ pageSize: 5 }}
                  dataSource={monthly}
                  rowKey="month"
                  columns={[
                    { title: "月份", dataIndex: "month" },
                    { title: "台数", dataIndex: "count" },
                    { title: "收入", dataIndex: "sell", render: (v) => fmt(v) },
                    {
                      title: "利润",
                      dataIndex: "profit",
                      render: (v) => (
                        <b style={{ color: v >= 0 ? "#16a34a" : "#e11d48" }}>
                          {fmt(v)}
                        </b>
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="🔥 最近回款">
                <Table
                  size="small"
                  pagination={false}
                  dataSource={recentSold}
                  rowKey="id"
                  columns={[
                    {
                      title: "设备",
                      key: "d",
                      render: (_, r) => (
                        <>
                          {r.brand} {r.model}
                          <br />
                          <span style={{ fontSize: 11, color: "#999" }}>
                            {r.incomeDate || r.sellSendDate || r.buyDate}
                          </span>
                        </>
                      ),
                    },
                    {
                      title: "收入",
                      dataIndex: "sellPrice",
                      render: (v) => fmt(v),
                    },
                    {
                      title: "利润",
                      key: "p",
                      render: (_, r) => {
                        const p = calcProfit(r);
                        return (
                          <b style={{ color: p >= 0 ? "#16a34a" : "#e11d48" }}>
                            {fmt(p)}
                          </b>
                        );
                      },
                    },
                  ]}
                />
                <div
                  style={{
                    marginTop: 10,
                    background: "#f0fdf4",
                    border: "1px dashed #86efac",
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 12,
                  }}
                >
                  出售渠道：
                  {methodStat.map((m) => (
                    <Tag key={m.name} style={{ marginBottom: 4 }}>
                      {m.name}×{m.count}
                    </Tag>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )}
      {tab === "list" && (
        <>
          <Card title="筛选">
            <Form
              form={qform}
              layout="inline"
              style={{ rowGap: 10 }}
              onFinish={(v) =>
                setFilters({
                  ...v,
                  day: v.day ? v.day.format("YYYY-MM-DD") : "",
                  month: v.month ? v.month.format("YYYY-MM") : "",
                  year: v.year ? v.year.format("YYYY") : "",
                })
              }
            >
              <Form.Item name="day" label="日">
                <DatePicker placeholder="请选择日期" />
              </Form.Item>
              <Form.Item name="week" label="周">
                <Input placeholder="2026-W20" style={{ width: 110 }} />
              </Form.Item>
              <Form.Item name="month" label="月">
                <DatePicker picker="month" placeholder="请选择月份" />
              </Form.Item>
              <Form.Item name="year" label="年">
                <DatePicker picker="year" placeholder="请选择年份" />
              </Form.Item>
              <Form.Item name="brand" label="品牌">
                <Input placeholder="Apple" style={{ width: 100 }} />
              </Form.Item>
              <Form.Item name="model" label="型号">
                <Input placeholder="iPhone" style={{ width: 120 }} />
              </Form.Item>
              <Form.Item name="memory" label="内存">
                <Input placeholder="256GB" style={{ width: 100 }} />
              </Form.Item>
              <Form.Item name="status" label="状态">
                <Select
                  allowClear
                  placeholder="全部"
                  style={{ width: 100 }}
                  options={[
                    { value: "sold", label: "已售" },
                    { value: "stock", label: "在库" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="keyword" label="关键词">
                <Input placeholder="颜色/地址/机况" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    筛选
                  </Button>
                  <Button
                    onClick={() => {
                      qform.resetFields();
                      setFilters({});
                    }}
                  >
                    清空
                  </Button>
                  <Upload
                    accept=".xlsx,.xls"
                    beforeUpload={doImportFile}
                    showUploadList={false}
                    maxCount={1}
                  >
                    <Button icon={<UploadOutlined />}>导入 xlsx</Button>
                  </Upload>
                  <Button icon={<DownloadOutlined />} onClick={doExport}>
                    导出 xlsx
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
          <Card>
            <Table
              rowKey="id"
              dataSource={filtered}
              columns={mergedColumns}
              components={{ header: { cell: ResizableTitle } }}
              scroll={{ x: 2900 }}
              pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 台` }}
            />
          </Card>
        </>
      )}
      {tab === "form" && (
        <Card title={editing ? "编辑记录" : "填报新机（利润自动计算）"}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              buyMethod: ["邮寄"],
              sellMethod: ["咸鱼"],
              buyDate: dayjs(),
            }}
          >
            <Row gutter={12}>
              <Col span={6}>
                <Form.Item
                  name="buyDate"
                  label="收购日期"
                  rules={[{ required: true }]}
                >
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="brand" label="品牌">
                  <Input placeholder="Apple / 华为" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="model" label="型号">
                  <Input placeholder="iPhone 15 Pro" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="memory" label="内存">
                  <Input placeholder="256GB" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="color" label="颜色">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="buyPrice" label="收购价格">
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="sellPrice" label="出售价格">
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="incomeDate" label="入账日期">
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              {[
                ["accessoryFee", "配件费"],
                ["repairFee", "维修费"],
                ["exposeFee", "曝光费"],
                ["buyShipFee", "收购邮费"],
                ["sellShipFee", "出售邮费"],
                ["agentFee", "代理费"],
                ["platformFee", "平台费"],
              ].map(([k, l]) => (
                <Col span={6} key={k}>
                  <Form.Item name={k} label={l}>
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              ))}
              <Col span={12}>
                <Form.Item name="buyAddr" label="收购地址">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="sellAddr" label="出售地址">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="buyMethod" label="收购方式（可多选）">
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="请选择，可多选"
                    options={METHOD_OPTIONS.map((v) => ({
                      value: v,
                      label: v,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="sellMethod" label="出售方式（可多选）">
                  <Select
                    mode="multiple"
                    allowClear
                    placeholder="请选择，可多选"
                    options={METHOD_OPTIONS.map((v) => ({
                      value: v,
                      label: v,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="buySendDate" label="收购发货日期">
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="buyArriveDate" label="收购到货日期">
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="sellSendDate" label="出售发货日期">
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="sellArriveDate" label="出售到货日期">
                  <DatePicker style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="condition" label="机况描述">
                  <Input.TextArea
                    rows={2}
                    placeholder="如 95新 电池88 无拆修"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" size="large">
                  {editing ? "保存修改" : "提交入库"}
                </Button>
                <Button
                  onClick={() => {
                    form.resetFields();
                    setEditing(null);
                  }}
                >
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}
    </div>
  );
}
export default function Page() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ token: { colorPrimary: "#5b50e8", borderRadius: 10 } }}
    >
      <App>
        <Inner />
      </App>
    </ConfigProvider>
  );
}
