<?php
/**
 * Envío de correo: SMTP (SSL/TLS o STARTTLS, AUTH LOGIN) o, si no se configura, mail() de PHP.
 * Animalista · Plataforma de firmas — © Jonnathan Bucheli Galindo
 */
final class Mailer
{
    /** @param array{host?:string,port?:int|string,secure?:string,user?:string,pass?:string,from_email?:string,from_name?:string} $cfg */
    public function __construct(private array $cfg) {}

    public static function fromSettings(): self
    {
        $raw = Db::setting('mail');
        return new self($raw ? (json_decode($raw, true) ?: []) : []);
    }

    /** @param array<int, array{name: string, mime: string, data: string}> $attachments */
    public function send(string $to, string $subject, string $html, string $text, array $attachments = []): void
    {
        $fromEmail = $this->cfg['from_email'] ?? ('no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
        $fromName = $this->cfg['from_name'] ?? 'Animalista';
        $alt = 'a' . bin2hex(random_bytes(12));
        $encSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $alternative = "--{$alt}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($text))
            . "--{$alt}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html))
            . "--{$alt}--\r\n";

        if ($attachments) {
            $mixed = 'm' . bin2hex(random_bytes(12));
            $contentType = "Content-Type: multipart/mixed; boundary=\"{$mixed}\"";
            $body = "--{$mixed}\r\nContent-Type: multipart/alternative; boundary=\"{$alt}\"\r\n\r\n" . $alternative;
            foreach ($attachments as $a) {
                $name = preg_replace('/[^A-Za-z0-9._-]/', '_', $a['name']);
                $body .= "--{$mixed}\r\nContent-Type: {$a['mime']}; name=\"{$name}\"\r\nContent-Transfer-Encoding: base64\r\n"
                    . "Content-Disposition: attachment; filename=\"{$name}\"\r\n\r\n" . chunk_split(base64_encode($a['data']));
            }
            $body .= "--{$mixed}--\r\n";
        } else {
            $contentType = "Content-Type: multipart/alternative; boundary=\"{$alt}\"";
            $body = $alternative;
        }
        $headers = [
            'From: ' . '=?UTF-8?B?' . base64_encode($fromName) . "?= <{$fromEmail}>",
            'MIME-Version: 1.0',
            $contentType,
            'X-Mailer: Animalista Firmas',
        ];

        if (empty($this->cfg['host'])) {
            if (!@mail($to, $encSubject, $body, implode("\r\n", $headers), '-f' . $fromEmail)) {
                throw new RuntimeException('No se pudo enviar el correo con mail(). Configura SMTP en Ajustes.');
            }
            return;
        }
        $this->smtp($fromEmail, $to, array_merge([
            "To: <{$to}>",
            "Subject: {$encSubject}",
            'Date: ' . date('r'),
            'Message-ID: <' . bin2hex(random_bytes(10)) . '@' . (explode('@', $fromEmail)[1] ?? 'localhost') . '>',
        ], $headers), $body);
    }

    private function smtp(string $from, string $to, array $headers, string $body): void
    {
        $host = $this->cfg['host'];
        $port = (int)($this->cfg['port'] ?? 587);
        $secure = $this->cfg['secure'] ?? 'tls'; // ssl | tls | none
        $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true, 'peer_name' => $host]]);
        $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
        if (!$fp) throw new RuntimeException("SMTP: no se pudo conectar a {$host}:{$port} ({$errstr})");
        stream_set_timeout($fp, 20);

        $read = function () use ($fp): array {
            $data = '';
            while (($line = fgets($fp, 515)) !== false) {
                $data .= $line;
                if (isset($line[3]) && $line[3] === ' ') break;
            }
            return [(int)substr($data, 0, 3), $data];
        };
        $cmd = function (string $c, array $ok) use ($fp, $read): string {
            fwrite($fp, $c . "\r\n");
            [$code, $resp] = $read();
            if (!in_array($code, $ok, true)) throw new RuntimeException('SMTP: ' . trim($resp));
            return $resp;
        };

        [$code, $resp] = $read();
        if ($code !== 220) throw new RuntimeException('SMTP: ' . trim($resp));
        $ehloHost = $_SERVER['SERVER_NAME'] ?? 'localhost';
        $cmd("EHLO {$ehloHost}", [250]);
        if ($secure === 'tls') {
            $cmd('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
                throw new RuntimeException('SMTP: no se pudo iniciar TLS');
            }
            $cmd("EHLO {$ehloHost}", [250]);
        }
        if (!empty($this->cfg['user'])) {
            $cmd('AUTH LOGIN', [334]);
            $cmd(base64_encode($this->cfg['user']), [334]);
            $cmd(base64_encode((string)($this->cfg['pass'] ?? '')), [235]);
        }
        $cmd("MAIL FROM:<{$from}>", [250]);
        $cmd("RCPT TO:<{$to}>", [250, 251]);
        $cmd('DATA', [354]);
        $msg = implode("\r\n", $headers) . "\r\n\r\n" . $body;
        $msg = preg_replace('/^\./m', '..', $msg);
        $cmd($msg . "\r\n.", [250]);
        $cmd('QUIT', [221]);
        fclose($fp);
    }
}
