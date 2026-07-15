'use client';

import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useRef} from 'react';

import {useMessage} from './MessageProvider';

const successMessages: Record<string, string> = {
  document_uploaded: '文档上传成功',
  lease_created: '租约创建成功',
  property_created: '房产创建成功',
  tenant_created: '租客创建成功',
  transaction_created: '交易记录添加成功'
};

const errorMessages: Record<string, string> = {
  charges_failed: '租金计划生成失败，请稍后重试',
  create_failed: '创建失败，请稍后重试',
  document_failed: '文档保存失败，请稍后重试',
  document_type: '请选择正确的文档类型',
  expense_failed: '支出记录添加失败，请稍后重试',
  expense_missing: '请填写支出日期和金额',
  file_missing: '请先选择要上传的文件',
  file_too_large: '文件过大，请选择较小的文件',
  lease_failed: '租约创建失败，请稍后重试',
  lease_missing: '未找到对应租约',
  missing_name: '请填写必填名称',
  missing_property: '未找到对应房产',
  payment_failed: '付款记录保存失败，请稍后重试',
  plan_limit: '当前套餐额度不足',
  revenue_failed: '收入记录添加失败，请稍后重试',
  revenue_missing: '请完整填写收入信息',
  revenue_overpaid: '付款金额不能超过待支付金额',
  storage_limit: '存储空间不足',
  upload_failed: '文件上传失败，请稍后重试'
};

function removeMessageParams(pathname: string, searchParams: URLSearchParams) {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete('success');
  nextParams.delete('error');
  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function RouteMessageListener() {
  const message = useMessage();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastMessageKeyRef = useRef('');

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const key = `${pathname}:${success ?? ''}:${error ?? ''}`;

    if ((!success && !error) || lastMessageKeyRef.current === key) {
      return;
    }

    lastMessageKeyRef.current = key;

    if (success) {
      message.success(successMessages[success] ?? '操作成功');
    }

    if (error) {
      message.error(errorMessages[error] ?? '操作失败，请稍后重试');
    }

    router.replace(removeMessageParams(pathname, searchParams), {scroll: false});
  }, [message, pathname, router, searchParams]);

  return null;
}
