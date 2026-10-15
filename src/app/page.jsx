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
dayjs.locale("zh-cn");

const KEY = "device_ledger_v1";
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
function seed() {
  const brands = [
    ["Apple", "iPhone 15 Pro", "256GB"],
    ["Apple", "iPhone 14", "128GB"],
    ["华为", "Mate 60 Pro", "512GB"],
    ["小米", "14 Ultra", "16+512GB"],
    ["OPPO", "Find X7", "12+256GB"],
  ];
  const arr = [];
  for (let i = 0; i < 18; i++) {
    const b = brands[i % brands.length];
    const m = String(5 + (i % 6)).padStart(2, "0");
    const buy = 2800 + ((i * 317) % 2500);
    const sell = buy + 300 + ((i * 211) % 900);
    arr.push({
      id: "seed" + i,
      buyDate: `2026-${m}-0${(i % 8) + 1}`,
      brand: b[0],
      model: b[1],
      memory: b[2],
      color: ["黑色", "白色", "蓝色", "钛原色"][i % 4],
      buyPrice: buy,
      sellPrice: i % 5 === 4 ? "" : sell,
      accessoryFee: 20,
      repairFee: i % 3 === 0 ? 150 : 0,
      exposeFee: 30,
      buyShipFee: 12,
      sellShipFee: 12,
      agentFee: 0,
      platformFee: 60,
      condition: "成色好 功能全好",
      buyAddr: "深圳",
      buyMethod: "邮寄",
      sellAddr: i % 5 === 4 ? "" : "广州",
      sellMethod: "平台(闲鱼/转转)",
      buySendDate: `2026-${m}-0${(i % 8) + 1}`,
      buyArriveDate: `2026-${m}-0${(i % 8) + 2}`,
      sellSendDate: "",
      sellArriveDate: "",
      incomeDate: i % 5 === 4 ? "" : `2026-${m}-1${i % 8}`,
    });
  }
  return arr;
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
  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setRows(JSON.parse(raw));
      else {
        const s = seed();
        setRows(s);
        localStorage.setItem(KEY, JSON.stringify(s));
      }
    } catch {
      setRows(seed());
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
        if (f.status === "sold" && !r.sellPrice) return false;
        if (f.status === "stock" && r.sellPrice) return false;
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

  const columns = [
    {
      title: "收购日期",
      dataIndex: "buyDate",
      key: "buyDate",
      width: 110,
      render: (v, r) => (
        <>
          {v}
          <br />
          <span style={{ color: "#999", fontSize: 11 }}>
            入账:{r.incomeDate || "-"}
          </span>
        </>
      ),
    },
    {
      title: "品牌型号",
      key: "bm",
      render: (_, r) => (
        <b>
          {r.brand} {r.model}
        </b>
      ),
    },
    {
      title: "内存/颜色",
      key: "mc",
      render: (_, r) => (
        <>
          {r.memory}
          <br />
          {r.color}
        </>
      ),
    },
    {
      title: "收购价",
      dataIndex: "buyPrice",
      render: (v) => fmt(v),
      sorter: (a, b) => n(a.buyPrice) - n(b.buyPrice),
    },
    {
      title: "出售价",
      dataIndex: "sellPrice",
      render: (v) => (v ? fmt(v) : "-"),
      sorter: (a, b) => n(a.sellPrice) - n(b.sellPrice),
    },
    {
      title: "利润",
      key: "p",
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
      render: (_, r) =>
        r.sellPrice ? <Tag color="green">已售</Tag> : <Tag>在库</Tag>,
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
    const lines = [labels.join(",")];
    filtered.forEach((r) =>
      lines.push(
        [
          ...keys.map((k) => `"${String(r[k] ?? "").replaceAll('"', "'")}"`),
          calcProfit(r),
        ].join(","),
      ),
    );
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `出入账_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
    message.success(`导出 ${filtered.length} 条`);
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
            共 {rows.length} 台 · 已售 {rows.filter((r) => r.sellPrice).length}{" "}
            · 在库 {rows.filter((r) => !r.sellPrice).length}
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
            <Button icon={<DownloadOutlined />} onClick={doExport}>
              导出CSV
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
        <>
          <Row gutter={12}>
            <Col span={5}>
              <Card>
                <Statistic title="累计台数" value={rows.length} suffix="台" />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic title="收购支出" value={total.buy} prefix="¥" />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic title="出售收入" value={total.sell} prefix="¥" />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic title="费用合计" value={total.fee} prefix="¥" />
              </Card>
            </Col>
            <Col span={4}>
              <Card>
                <Statistic
                  title="累计利润"
                  value={total.profit}
                  prefix="¥"
                  valueStyle={{ color: "#16a34a" }}
                />
              </Card>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={16}>
              <Card title="月度利润趋势">
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 10,
                    height: 220,
                    background: "#f8faff",
                    borderRadius: 12,
                    padding: "14px 10px 8px",
                    border: "1px dashed #e5e8f1",
                  }}
                >
                  {monthly.map((m) => (
                    <div
                      key={m.month}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 4,
                        height: "100%",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800 }}>
                        {m.profit}
                      </div>
                      <div
                        title={`${m.month} 出售${m.sell}`}
                        style={{
                          width: "70%",
                          height: Math.max(6, (m.sell / maxSell) * 140),
                          borderRadius: "8px 8px 4px 4px",
                          background: "linear-gradient(180deg,#34d399,#059669)",
                        }}
                      />
                      <span style={{ fontSize: 11, color: "#888" }}>
                        {m.month.slice(5)}月·{m.count}台
                      </span>
                    </div>
                  ))}
                </div>
                <Space wrap style={{ marginTop: 10 }}>
                  {monthly.map((m) => (
                    <Tag key={m.month} color="green">
                      {m.month} 利润 {fmt(m.profit)}
                    </Tag>
                  ))}
                </Space>
              </Card>
            </Col>
            <Col span={8}>
              <Card title="月度明细">
                <Table
                  size="small"
                  pagination={false}
                  dataSource={monthly}
                  rowKey="month"
                  columns={[
                    { title: "月份", dataIndex: "month" },
                    { title: "台数", dataIndex: "count" },
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
          </Row>
        </>
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
                <DatePicker />
              </Form.Item>
              <Form.Item name="week" label="周">
                <Input placeholder="2026-W20" style={{ width: 110 }} />
              </Form.Item>
              <Form.Item name="month" label="月">
                <DatePicker picker="month" />
              </Form.Item>
              <Form.Item name="year" label="年">
                <DatePicker picker="year" />
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
                </Space>
              </Form.Item>
            </Form>
          </Card>
          <Card>
            <Table
              rowKey="id"
              dataSource={filtered}
              columns={columns}
              scroll={{ x: 1100 }}
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
              buyMethod: "邮寄",
              sellMethod: "平台(闲鱼/转转)",
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
                <Form.Item name="buyMethod" label="收购方式">
                  <Select
                    options={["当面", "邮寄", "平台", "同行调货", "其他"].map(
                      (v) => ({ value: v, label: v }),
                    )}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="sellMethod" label="出售方式">
                  <Select
                    options={[
                      "当面",
                      "邮寄",
                      "平台(闲鱼/转转)",
                      "直播",
                      "同行",
                      "其他",
                    ].map((v) => ({ value: v, label: v }))}
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
      theme={{ token: { colorPrimary: "#5b50e8", borderRadius: 10 } }}
    >
      <App>
        <Inner />
      </App>
    </ConfigProvider>
  );
}
